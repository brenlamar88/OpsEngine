#!/usr/bin/env bash
# =====================================================================
# verify-migrations.sh
#
# Reproducible, Docker-free verification harness for supabase/migrations/.
#
# Spins up a throwaway local PostgreSQL 16 cluster (fresh initdb'd PGDATA
# under a temp dir, unix-socket only, no Docker involved), applies
# scripts/db-bootstrap.sql to stand in for the parts of the Supabase
# platform the migrations assume exist (auth schema/roles/auth.uid()
# etc), then applies every *.sql file in supabase/migrations/ in
# filename order with `psql -v ON_ERROR_STOP=1`. Prints PASS/FAIL and,
# on failure, the first failing file + the error psql reported. Always
# tears the cluster down and removes the temp PGDATA on exit.
#
# Usage:
#   bash scripts/verify-migrations.sh [extra-migration.sql]
#
# The optional argument is an additional .sql file (e.g. a not-yet
# committed migration you're drafting) applied LAST, after every file
# already under supabase/migrations/.
#
# Exit status: 0 iff every migration (and the optional extra file, if
# given) applied with no error. Non-zero otherwise.
#
# supabase/migrations/*.sql is treated as append-only source of truth
# and is never modified by this script.
# =====================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
BOOTSTRAP_SQL="$REPO_ROOT/scripts/db-bootstrap.sql"
DBNAME="supabase_verify"

# ---------------------------------------------------------------------
# Resolve the optional "extra sql file" argument to an absolute path
# *now*, before we potentially re-exec as another user (which may not
# share the invoking shell's cwd resolution the same way for relative
# paths passed through positional args).
# ---------------------------------------------------------------------
EXTRA_SQL=""
if [[ $# -gt 0 ]]; then
  if [[ ! -f "$1" ]]; then
    echo "verify-migrations: extra sql file not found: $1" >&2
    exit 2
  fi
  EXTRA_SQL="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
fi

log() { echo "[verify-migrations] $*" >&2; }

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
  echo "verify-migrations: could not locate a PostgreSQL 16 bin dir (initdb/pg_ctl/psql). Is postgresql-16 installed?" >&2
  exit 2
fi
export PATH="$PG_BINDIR:$PATH"

PG_SHAREDIR="$("$PG_BINDIR/pg_config" --sharedir)"
PG_EXTDIR="$PG_SHAREDIR/extension"
PG_VERSION_MAJOR="$("$PG_BINDIR/pg_ctl" --version | grep -oE '[0-9]+' | head -1)"

# =======================================================================
# Root-only, one-time-ish system prep. This installs OS-level artifacts
# (an apt package, a couple of extension stub files) that no amount of
# SQL run *inside* a psql session can create, and that a non-privileged
# `postgres` user has no permission to write. Everything here is
# idempotent: safe, cheap, and correct to run again on every invocation.
#
# 1) pg_cron: supabase/migrations/20260127193030_...sql runs
#    `CREATE EXTENSION IF NOT EXISTS pg_cron`. Ubuntu ships a real
#    pg_cron build as the postgresql-16-cron package; install it if
#    missing so the extension is genuinely functional (not a stub).
#    pg_cron additionally requires shared_preload_libraries='pg_cron'
#    to be set in postgresql.conf *before* the server first starts --
#    that part happens later, after initdb, while we're still root-ish
#    (or already running as postgres; either way it's just a config
#    file edit before `pg_ctl start`).
#
# 2) pg_net: same migration also runs
#    `CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions`.
#    pg_net is Supabase-specific: there is no Ubuntu/apt package for it
#    and building it from source requires a Rust/pgrx toolchain plus
#    network access this environment doesn't reliably have. No
#    migration in this repo actually calls a net.http_* function --
#    they only CREATE EXTENSION it -- so we install a minimal, local,
#    non-functional STUB extension (schema `net` + no-op functions)
#    with the same name/entry points, purely so `CREATE EXTENSION`
#    succeeds structurally. This is the one non-obvious stub in this
#    harness; see the comment block in db-bootstrap.sql for the same
#    explanation.
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
# local verification harness. No network I/O is actually performed.
comment = 'LOCAL STUB of pg_net (async HTTP) for migration verification only -- not functional'
default_version = '0.1'
relocatable = true
EOF
  cat > "$PG_EXTDIR/pg_net--0.1.sql" <<'EOF'
-- Local stub of pg_net. Mirrors the real extension's public surface
-- (the `net` schema plus the http_* request functions) closely enough
-- that `CREATE EXTENSION pg_net` succeeds and any migration that merely
-- references these functions can still create dependent objects. None
-- of this performs real HTTP requests.
CREATE SCHEMA IF NOT EXISTS net;
COMMENT ON SCHEMA net IS 'LOCAL STUB of pg_net schema -- verification harness only, not functional';

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

if [[ $EUID -eq 0 ]]; then
  ensure_pg_cron_package
  ensure_pg_net_stub

  # Re-exec the rest of this script as the unprivileged `postgres`
  # system user -- PostgreSQL refuses to run initdb/postgres as root.
  # --preserve-env=PATH keeps our resolved PG_BINDIR-first PATH.
  if ! id postgres >/dev/null 2>&1; then
    echo "verify-migrations: running as root and no 'postgres' system user exists to drop privileges to." >&2
    exit 2
  fi
  log "Running as root; re-executing as system user 'postgres' for initdb/pg_ctl ..."
  exec sudo -u postgres --preserve-env=PATH -H bash "${BASH_SOURCE[0]}" ${EXTRA_SQL:+"$EXTRA_SQL"}
fi

# From here on we are NOT root (either we started that way and just
# re-exec'd as `postgres`, or the caller invoked us directly as some
# other non-root user that already has permission to run initdb).
ensure_pg_cron_package || true
ensure_pg_net_stub || true

# ---------------------------------------------------------------------
# Fresh temp cluster
# ---------------------------------------------------------------------
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/pgverify.XXXXXX")"
PGDATA="$WORKDIR/pgdata"
SOCKDIR="$WORKDIR/sock"
LOGFILE="$WORKDIR/postgres.log"
mkdir -p "$SOCKDIR"

PG_PID=""
cleanup() {
  local ec=$?
  if [[ -n "$PG_PID" ]] && "$PG_BINDIR/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    log "Stopping temp postgres cluster ..."
    "$PG_BINDIR/pg_ctl" -D "$PGDATA" -m fast stop >/dev/null 2>&1 || true
  fi
  log "Removing temp cluster dir $WORKDIR ..."
  rm -rf "$WORKDIR"
  exit "$ec"
}
trap cleanup EXIT INT TERM

log "Temp PGDATA: $PGDATA"
log "Running initdb ..."
"$PG_BINDIR/initdb" -D "$PGDATA" -U postgres --auth=trust --no-sync -E UTF8 >"$WORKDIR/initdb.log" 2>&1 \
  || { echo "FAIL: initdb failed; see $WORKDIR/initdb.log" >&2; cat "$WORKDIR/initdb.log" >&2; exit 1; }

{
  echo "listen_addresses = ''"
  echo "unix_socket_directories = '$SOCKDIR'"
  echo "shared_preload_libraries = 'pg_cron'"
  echo "cron.database_name = '$DBNAME'"
  echo "fsync = off"
  echo "synchronous_commit = off"
  echo "full_page_writes = off"
} >> "$PGDATA/postgresql.conf"

log "Starting postgres ..."
if ! "$PG_BINDIR/pg_ctl" -D "$PGDATA" -l "$LOGFILE" -w -t 60 start >"$WORKDIR/pg_ctl_start.log" 2>&1; then
  echo "FAIL: postgres failed to start; server log follows" >&2
  cat "$LOGFILE" >&2 2>/dev/null || true
  exit 1
fi
PG_PID="started"

export PGHOST="$SOCKDIR"
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
  echo "verify-migrations: no *.sql files found under $MIGRATIONS_DIR" >&2
  exit 2
fi

if [[ -n "$EXTRA_SQL" ]]; then
  FILES+=("$EXTRA_SQL")
fi

APPLIED=0
for f in "${FILES[@]}"; do
  rel="${f#"$REPO_ROOT"/}"
  if ! out="$(run_sql_file "$f")"; then
    echo "" >&2
    echo "FAIL" >&2
    echo "First failing file: $rel" >&2
    echo "---- psql output ----" >&2
    echo "$out" >&2
    exit 1
  fi
  APPLIED=$((APPLIED + 1))
done

log "Applied $APPLIED migration file(s) cleanly."
echo "PASS: all $APPLIED migration file(s) under supabase/migrations/$( [[ -n "$EXTRA_SQL" ]] && echo " (+1 extra file)" ) applied cleanly against PostgreSQL $("$PG_BINDIR/postgres" --version | grep -oE '[0-9]+\.[0-9]+' | head -1)."
exit 0
