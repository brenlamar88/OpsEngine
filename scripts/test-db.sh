#!/usr/bin/env bash
# =====================================================================
# test-db.sh
#
# Docker-free harness that boots a throwaway PostgreSQL 16 cluster
# LISTENING ON TCP (127.0.0.1, a free ephemeral port), applies
# scripts/db-bootstrap.sql + every migration under supabase/migrations/
# (exactly like scripts/verify-migrations.sh), applies the Supabase-
# default public-schema grants on top (mirrors the managed platform --
# RLS, not GRANT, is what's meant to gate access), then runs the
# command passed as arguments with TEST_DATABASE_URL pointed at that
# cluster. The cluster is always torn down on exit, and this script
# exits with the wrapped command's exit code.
#
# Usage:
#   bash scripts/test-db.sh <command> [args...]
#
# Example:
#   bash scripts/test-db.sh npx vitest run src/test/isolation.test.ts
#
# Exit status: whatever the wrapped command exits with (or 2 for a
# harness-level setup failure before the command ever runs).
#
# Privilege model: only the two operations PostgreSQL itself refuses to
# run as root -- initdb and starting the postmaster (pg_ctl start/stop)
# -- are dropped to the unprivileged system user `postgres` (mirroring
# scripts/verify-migrations.sh). Everything else, including the wrapped
# command, runs as whichever user invoked this script: createdb/psql
# connect over TCP (127.0.0.1) using trust auth, which -- unlike the
# Unix-socket/peer path -- does not care which OS user is asking, so
# there's no need to run the wrapped command (e.g. `npx vitest`) as
# `postgres`, which would otherwise be unable to write into this repo's
# node_modules/.
# =====================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BOOTSTRAP_SQL="$REPO_ROOT/scripts/db-bootstrap.sql"
DBNAME="opsengine_test"

if [[ $# -eq 0 ]]; then
  echo "test-db: usage: bash scripts/test-db.sh <command> [args...]" >&2
  exit 2
fi

log() { echo "[test-db] $*" >&2; }

# ---------------------------------------------------------------------
# Locate the PostgreSQL 16 toolchain regardless of what's on PATH.
# ---------------------------------------------------------------------
find_pg_bindir() {
  if command -v pg_config >/dev/null 2>&1; then
    pg_config --bindir
    return 0
  fi
  local d
  for d in /usr/lib/postgresql/16/bin /usr/lib/postgresql/*/bin; do
    if [[ -x "$d/postgres" ]]; then
      echo "$d"
      return 0
    fi
  done
  return 1
}

PG_BINDIR="$(find_pg_bindir || true)"
if [[ -z "${PG_BINDIR:-}" ]]; then
  echo "test-db: could not locate a PostgreSQL 16 bin dir (initdb/pg_ctl/psql). Is postgresql-16 installed?" >&2
  exit 2
fi
export PATH="$PG_BINDIR:$PATH"

PG_SHAREDIR="$("$PG_BINDIR/pg_config" --sharedir)"
PG_EXTDIR="$PG_SHAREDIR/extension"
PG_VERSION_MAJOR="$("$PG_BINDIR/pg_ctl" --version | grep -oE '[0-9]+' | head -1)"

# =======================================================================
# Root-only, one-time-ish system prep -- see scripts/verify-migrations.sh
# for the full rationale (identical logic, duplicated here so this script
# has no runtime dependency on that one). Idempotent; safe to run again.
# =======================================================================
ensure_pg_cron_package() {
  if [[ -f "$PG_EXTDIR/pg_cron.control" ]]; then
    return 0
  fi
  if [[ $EUID -ne 0 ]]; then
    log "WARNING: pg_cron.control missing and not running as root; cannot apt-get install postgresql-${PG_VERSION_MAJOR}-cron. CREATE EXTENSION pg_cron will fail."
    return 0
  fi
  log "Installing postgresql-${PG_VERSION_MAJOR}-cron (apt) ..."
  export DEBIAN_FRONTEND=noninteractive
  if ! apt-get install -y "postgresql-${PG_VERSION_MAJOR}-cron" >/dev/null 2>&1; then
    apt-get update -qq >/dev/null 2>&1 || true
    apt-get install -y "postgresql-${PG_VERSION_MAJOR}-cron" >/dev/null 2>&1 \
      || log "WARNING: failed to install postgresql-${PG_VERSION_MAJOR}-cron; CREATE EXTENSION pg_cron will fail."
  fi
}

ensure_pg_net_stub() {
  if [[ -f "$PG_EXTDIR/pg_net.control" ]]; then
    return 0
  fi
  if [[ $EUID -ne 0 ]]; then
    log "WARNING: pg_net.control missing and not running as root; cannot write extension stub. CREATE EXTENSION pg_net will fail."
    return 0
  fi
  log "Installing local pg_net stub extension into $PG_EXTDIR ..."
  cat > "$PG_EXTDIR/pg_net.control" <<'EOF'
# Local, non-functional stub of the Supabase pg_net extension.
# Exists ONLY so `CREATE EXTENSION pg_net` succeeds in this Docker-free
# local test harness. No network I/O is actually performed.
comment = 'LOCAL STUB of pg_net (async HTTP) for isolation test harness only -- not functional'
default_version = '0.1'
relocatable = true
EOF
  cat > "$PG_EXTDIR/pg_net--0.1.sql" <<'EOF'
-- Local stub of pg_net. See scripts/verify-migrations.sh / db-bootstrap.sql
-- for the full explanation. Not functional -- no real HTTP requests.
CREATE SCHEMA IF NOT EXISTS net;
COMMENT ON SCHEMA net IS 'LOCAL STUB of pg_net schema -- test harness only, not functional';

CREATE OR REPLACE FUNCTION net.http_get(
  url text,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000
) RETURNS bigint
  LANGUAGE sql
AS $$ SELECT 0::bigint; $$;

CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  body jsonb DEFAULT '{}'::jsonb,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000
) RETURNS bigint
  LANGUAGE sql
AS $$ SELECT 0::bigint; $$;

CREATE OR REPLACE FUNCTION net.http_delete(
  url text,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000
) RETURNS bigint
  LANGUAGE sql
AS $$ SELECT 0::bigint; $$;
EOF
}

# RUN_AS_POSTGRES: command prefix used ONLY for initdb / pg_ctl (the
# operations PostgreSQL refuses to run as root). Empty when we're not
# root -- in that case the invoking user is assumed to already have
# permission to run initdb directly (same assumption verify-migrations.sh
# makes).
RUN_AS_POSTGRES=()
if [[ $EUID -eq 0 ]]; then
  ensure_pg_cron_package
  ensure_pg_net_stub
  if ! id postgres >/dev/null 2>&1; then
    echo "test-db: running as root and no 'postgres' system user exists to drop privileges to." >&2
    exit 2
  fi
  RUN_AS_POSTGRES=(sudo -u postgres --preserve-env=PATH -H)
else
  ensure_pg_cron_package || true
  ensure_pg_net_stub || true
fi

# ---------------------------------------------------------------------
# Pick a free TCP port on 127.0.0.1.
# ---------------------------------------------------------------------
find_free_port() {
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PYEOF'
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PYEOF
  elif command -v node >/dev/null 2>&1; then
    node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()});"
  else
    echo "test-db: neither python3 nor node available to pick a free TCP port" >&2
    return 1
  fi
}
PGPORT_FREE="$(find_free_port)"
if [[ -z "$PGPORT_FREE" ]]; then
  echo "test-db: failed to determine a free TCP port" >&2
  exit 2
fi

# ---------------------------------------------------------------------
# Fresh temp cluster
# ---------------------------------------------------------------------
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/pgtestdb.XXXXXX")"
PGDATA="$WORKDIR/pgdata"
SOCKDIR="$WORKDIR/sock"
LOGFILE="$WORKDIR/postgres.log"
mkdir -p "$SOCKDIR"
if [[ ${#RUN_AS_POSTGRES[@]} -gt 0 ]]; then
  # initdb/pg_ctl will run as `postgres`; it needs to be able to write
  # PGDATA, the socket dir, and the server log under WORKDIR.
  chown -R postgres:postgres "$WORKDIR"
fi

CMD_EXIT_CODE=""
cleanup() {
  local ec=$?
  if "${RUN_AS_POSTGRES[@]}" "$PG_BINDIR/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    log "Stopping temp postgres cluster ..."
    "${RUN_AS_POSTGRES[@]}" "$PG_BINDIR/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  log "Removing temp cluster dir $WORKDIR ..."
  rm -rf "$WORKDIR"
  if [[ -n "$CMD_EXIT_CODE" ]]; then
    exit "$CMD_EXIT_CODE"
  fi
  exit "$ec"
}
trap cleanup EXIT INT TERM

log "Temp PGDATA: $PGDATA"
log "Chosen TCP port: $PGPORT_FREE"
log "Running initdb ..."
"${RUN_AS_POSTGRES[@]}" "$PG_BINDIR/initdb" -D "$PGDATA" -U postgres --auth=trust --no-sync -E UTF8 >"$WORKDIR/initdb.log" 2>&1 \
  || { echo "FAIL: initdb failed; see $WORKDIR/initdb.log" >&2; cat "$WORKDIR/initdb.log" >&2; exit 1; }

{
  echo "listen_addresses = '127.0.0.1'"
  echo "port = $PGPORT_FREE"
  echo "unix_socket_directories = '$SOCKDIR'"
  echo "shared_preload_libraries = 'pg_cron'"
  echo "cron.database_name = '$DBNAME'"
  echo "fsync = off"
  echo "synchronous_commit = off"
  echo "full_page_writes = off"
} >> "$PGDATA/postgresql.conf"

log "Starting postgres ..."
if ! "${RUN_AS_POSTGRES[@]}" "$PG_BINDIR/pg_ctl" -D "$PGDATA" -l "$LOGFILE" -w -t 60 start >"$WORKDIR/pg_ctl_start.log" 2>&1; then
  echo "FAIL: postgres failed to start; server log follows" >&2
  cat "$LOGFILE" >&2 2>/dev/null || true
  exit 1
fi

# From here on, every client operation (createdb/psql/the wrapped test
# command) connects over TCP as whichever OS user invoked this script --
# trust auth on the 127.0.0.1 host entry doesn't check OS identity, only
# the PG role name, so there's no need (and, for a repo owned by a
# different OS user than `postgres`, no ability) to run these as
# `postgres`.
export PGHOST="127.0.0.1"
export PGPORT="$PGPORT_FREE"
export PGUSER="postgres"

log "Creating database $DBNAME ..."
"$PG_BINDIR/createdb" "$DBNAME"

run_sql_file() {
  local file="$1"
  "$PG_BINDIR/psql" -v ON_ERROR_STOP=1 -X -q -d "$DBNAME" -f "$file" 2>&1
}

log "Applying db-bootstrap.sql ..."
if ! out="$(run_sql_file "$BOOTSTRAP_SQL")"; then
  echo "FAIL: scripts/db-bootstrap.sql" >&2
  echo "$out" >&2
  exit 1
fi

log "Applying migrations from $MIGRATIONS_DIR (filename order) ..."
FILES=()
while IFS= read -r -d '' f; do
  FILES+=("$f")
done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "test-db: no *.sql files found under $MIGRATIONS_DIR" >&2
  exit 2
fi

APPLIED=0
for f in "${FILES[@]}"; do
  rel="${f#"$REPO_ROOT"/}"
  if ! out="$(run_sql_file "$f")"; then
    echo "" >&2
    echo "FAIL" >&2
    echo "First failing migration file: $rel" >&2
    echo "---- psql output ----" >&2
    echo "$out" >&2
    exit 1
  fi
  APPLIED=$((APPLIED + 1))
done
log "Applied $APPLIED migration file(s) cleanly."

# ---------------------------------------------------------------------
# Supabase-default grants. On the real platform, PostgREST-facing roles
# (anon/authenticated/service_role) get schema USAGE plus blanket table/
# sequence/function grants in `public` -- access control is then RLS's
# job, not GRANT's. db-bootstrap.sql already sets this up via ALTER
# DEFAULT PRIVILEGES for objects created going forward, but that only
# covers objects created *by role postgres after* the ALTER DEFAULT
# PRIVILEGES statement ran, scoped to schema `public`. Re-assert the
# blanket grants explicitly here, after all migrations (which may have
# created objects as various roles, added new tables, etc.) have run, so
# the grants are unconditionally correct no matter how objects were
# created. This mirrors the platform -- it is not a weakening of RLS,
# RLS (once Phase 2's policies exist) still governs every row.
# ---------------------------------------------------------------------
log "Applying Supabase-default public-schema grants ..."
GRANTS_SQL="
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
"
if ! out="$("$PG_BINDIR/psql" -v ON_ERROR_STOP=1 -X -q -d "$DBNAME" -c "$GRANTS_SQL" 2>&1)"; then
  echo "FAIL: applying Supabase-default grants" >&2
  echo "$out" >&2
  exit 1
fi

TEST_DATABASE_URL="postgres://postgres@127.0.0.1:${PGPORT_FREE}/${DBNAME}"
log "TEST_DATABASE_URL=$TEST_DATABASE_URL"
export TEST_DATABASE_URL

log "Running: $*"
set +e
(
  cd "$REPO_ROOT"
  "$@"
)
CMD_EXIT_CODE=$?
set -e

if [[ "$CMD_EXIT_CODE" -eq 0 ]]; then
  log "Command exited 0."
else
  log "Command exited $CMD_EXIT_CODE."
fi

exit "$CMD_EXIT_CODE"
