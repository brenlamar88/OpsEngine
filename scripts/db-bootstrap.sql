-- =====================================================================
-- db-bootstrap.sql
--
-- Minimal, local (non-Docker) stand-in for the Supabase platform layer.
-- This is NOT a Supabase migration and lives outside supabase/migrations/
-- on purpose: it exists only so that a vanilla PostgreSQL 16 cluster has
-- the roles / schemas / auth.users table / auth.* helper functions that
-- the real Supabase-authored migrations in supabase/migrations/ assume
-- already exist on the platform (auth schema, anon/authenticated/
-- service_role roles, auth.uid()/auth.role()/auth.jwt()/auth.email(),
-- etc).
--
-- It is applied once, immediately after creating the scratch database
-- and before any file under supabase/migrations/ is applied, by
-- scripts/verify-migrations.sh.
--
-- Extensions actually required by supabase/migrations/*.sql (discovered
-- by running the migrations against a bare PG16 cluster and iterating on
-- errors) are pg_cron and pg_net -- both of those are created BY the
-- migrations themselves (20260127193030_...sql), so this file does not
-- pre-create them. What this file (together with verify-migrations.sh)
-- has to guarantee is that `CREATE EXTENSION` for those two can actually
-- succeed on this box:
--   * pg_cron requires the postgresql-16-cron OS package (installed via
--     apt by verify-migrations.sh when missing) and shared_preload_libraries
--     = 'pg_cron' set in postgresql.conf BEFORE the server starts (also
--     handled by verify-migrations.sh, since that can't be done from SQL
--     after the server is already up).
--   * pg_net is a Supabase-only extension with no Ubuntu/apt package and
--     no Docker available in this environment. verify-migrations.sh
--     installs a minimal local STUB pg_net.control/pg_net--0.1.sql pair
--     into the PostgreSQL extension directory (schema `net`, no-op
--     functions) purely so `CREATE EXTENSION IF NOT EXISTS pg_net WITH
--     SCHEMA extensions;` succeeds structurally. It is NOT a functional
--     HTTP client -- no migration in this repo actually calls
--     net.http_get/post/etc, they only CREATE EXTENSION it.
--
-- gen_random_uuid() is used extensively by the migrations but needs no
-- extension: it has been a PostgreSQL core (pg_catalog) builtin since
-- PG13, so nothing to add here for that.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Schemas
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;

-- ---------------------------------------------------------------------
-- Roles
--
-- anon / authenticated / service_role: the three PostgREST-facing roles
-- every Supabase project has. authenticator: the role PostgREST itself
-- logs in as and switches (SET ROLE) into one of the above per-request.
-- supabase_auth_admin: the role that owns/manages the auth schema on a
-- real Supabase project (some migrations authored via the Supabase
-- dashboard/CLI are generated assuming it exists, even if this repo's
-- migrations don't reference it directly).
--
-- CREATE ROLE has no IF NOT EXISTS, so guard with DO blocks to keep this
-- file safe to run more than once against the same cluster.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN NOINHERIT CREATEROLE BYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN NOSUPERUSER;
  END IF;
END
$$;

-- authenticator impersonates the other three via SET ROLE, so it needs
-- membership in each of them (this is exactly how PostgREST/Supabase
-- wires it up).
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Let the bootstrapping/migrating superuser (postgres) impersonate the
-- app roles too, which is convenient for local testing via
-- `SET ROLE authenticated;` from a `psql -U postgres` session.
GRANT anon TO postgres;
GRANT authenticated TO postgres;
GRANT service_role TO postgres;

-- ---------------------------------------------------------------------
-- Schema-level grants, mirroring what a real Supabase project grants to
-- the PostgREST-facing roles.
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, postgres;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role, postgres;

-- Any table/sequence the migrations create in `public` (as role
-- postgres) should be usable by the app roles too, same as on the
-- managed platform, so that RLS -- not a missing GRANT -- is what gates
-- access when tests later impersonate anon/authenticated.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- auth.users
--
-- A trimmed-down copy of the real Supabase auth.users table: enough
-- columns for every column any migration or the on_auth_user_created
-- trigger in this repo references (id, email, raw_user_meta_data),
-- plus the handful of other columns that are so commonly touched by
-- Supabase-authored SQL that it's worth having them present up front.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth.users (
  instance_id uuid,
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  aud varchar(255),
  role varchar(255),
  email varchar(255) UNIQUE,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar(255),
  confirmation_sent_at timestamptz,
  recovery_token varchar(255),
  recovery_sent_at timestamptz,
  email_change_token_new varchar(255),
  email_change varchar(255),
  email_change_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  phone text UNIQUE,
  phone_confirmed_at timestamptz,
  phone_change text DEFAULT '',
  phone_change_token varchar(255) DEFAULT '',
  phone_change_sent_at timestamptz,
  email_change_token_current varchar(255) DEFAULT '',
  email_change_confirm_status smallint DEFAULT 0,
  banned_until timestamptz,
  reauthentication_token varchar(255) DEFAULT '',
  reauthentication_sent_at timestamptz,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  is_anonymous boolean NOT NULL DEFAULT false
);

GRANT SELECT ON auth.users TO anon, authenticated, service_role, postgres;

-- ---------------------------------------------------------------------
-- auth.uid() / auth.role() / auth.jwt() / auth.email()
--
-- Real implementations, matching what Supabase itself ships: they read
-- the `request.jwt.claims` GUC (a JSON blob PostgREST sets per-request
-- from the caller's JWT). Locally, a test can impersonate a user by
-- running, in the same session/transaction:
--
--   SET request.jwt.claims = '{"sub":"<uuid>","role":"authenticated","email":"a@b.com"}';
--   SET ROLE authenticated;
--
-- and every RLS policy written against auth.uid()/auth.role()/etc. will
-- behave exactly as it would against real Supabase.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
  LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
AS $$
  SELECT NULLIF((auth.jwt() ->> 'sub'), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
  LANGUAGE sql STABLE
AS $$
  SELECT NULLIF((auth.jwt() ->> 'role'), '')
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
  LANGUAGE sql STABLE
AS $$
  SELECT NULLIF((auth.jwt() ->> 'email'), '')
$$;

GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role, postgres, public;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role, postgres, public;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role, postgres, public;
GRANT EXECUTE ON FUNCTION auth.email() TO anon, authenticated, service_role, postgres, public;

-- ---------------------------------------------------------------------
-- supabase_realtime publication
--
-- On a real Supabase project the platform itself creates an initially
-- empty `supabase_realtime` publication; user migrations then just
-- ALTER PUBLICATION ... ADD TABLE into it (see
-- 20260114152502_...sql:35). CREATE PUBLICATION has no IF NOT EXISTS,
-- so guard with a catalog check for idempotency.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;
