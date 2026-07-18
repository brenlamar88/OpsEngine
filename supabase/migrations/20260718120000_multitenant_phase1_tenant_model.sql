-- =============================================================================
-- Multi-tenant migration — Phase 1: Tenant model
-- =============================================================================
-- This migration introduces the foundational tenant model (organizations +
-- org_members) and adds a nullable-then-NOT-NULL org_id column to every
-- tenant-scoped table, backfilling all existing rows into a single
-- deterministic "default" organization so the app continues to behave as a
-- single-tenant system until Phase 2 (RLS policies) and later phases land.
--
-- Scope of this migration:
--   1. Create public.organizations and public.org_members (RLS enabled, but
--      NO policies yet — those are added in Phase 2).
--   2. Add nullable org_id to all 12 tenant tables.
--   3. Insert the single default org and backfill org_id in dependency order
--      (facilities -> global tables -> units -> unit-keyed tables ->
--      facility-keyed tables), with a final safety-net sweep so no row can
--      be left with a NULL org_id.
--   4. Copy public.user_roles into public.org_members for compatibility.
--      NOTE: public.user_roles is intentionally retained (not dropped, not
--      altered) — it remains the source of truth for role checks until it
--      is retired in Phase 3 of the multi-tenant migration.
--   5. Set org_id NOT NULL on all 12 tenant tables.
--   6. Replace the three global single-column UNIQUE constraints that would
--      otherwise collide across tenants (facilities.code, budget_years.year,
--      budget_rows.row_key) — and the composite unique index on
--      public.budgets — with org-scoped equivalents.
--   7. Add org_id indexes (plus a composite org_id+date index on
--      actual_entries) to keep tenant-scoped queries fast.
--
-- This migration is written to be safe to run against both an empty (dev)
-- database and a populated (prod) database: every backfill UPDATE is a
-- no-op when its source table is empty, and every DROP uses IF EXISTS.
-- =============================================================================


-- =============================================================================
-- 1. New tables: organizations, org_members
-- =============================================================================

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- RLS is enabled now so the tables are never briefly exposed without it, but
-- no policies are added here — access policies are Phase 2's responsibility.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_members_updated_at
  BEFORE UPDATE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =============================================================================
-- 2. Add nullable org_id to all 12 tenant tables
-- =============================================================================

ALTER TABLE public.facilities                     ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.budget_years                    ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.budget_sections                  ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.budget_rows                     ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.budgets                         ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.actual_entries                   ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.units                           ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.daily_operations                 ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.service_development_entries       ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.iop_patients                    ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.unit_budget_config               ADD COLUMN org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.program_ranking_daily_actuals      ADD COLUMN org_id uuid REFERENCES public.organizations(id);


-- =============================================================================
-- 3. Backfill single tenant org
-- =============================================================================

-- Fixed UUID so the backfill below is deterministic and idempotent.
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Freedom Behavioral Health', 'freedom-behavioral-health')
ON CONFLICT (id) DO NOTHING;

-- 3a. facilities: the root of the tenant hierarchy.
UPDATE public.facilities
SET org_id = '00000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

-- 3b. Global (facility-independent) tables go straight to the single org.
UPDATE public.budget_years
SET org_id = '00000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE public.budget_sections
SET org_id = '00000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

UPDATE public.budget_rows
SET org_id = '00000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

-- 3c. units derive org_id from their facility.
UPDATE public.units u
SET org_id = f.org_id
FROM public.facilities f
WHERE u.facility_id = f.id
  AND u.org_id IS NULL;

-- 3d. Tables keyed on unit_id derive org_id via units.
UPDATE public.budgets b
SET org_id = u.org_id
FROM public.units u
WHERE b.unit_id = u.id
  AND b.org_id IS NULL;

UPDATE public.actual_entries a
SET org_id = u.org_id
FROM public.units u
WHERE a.unit_id = u.id
  AND a.org_id IS NULL;

UPDATE public.unit_budget_config c
SET org_id = u.org_id
FROM public.units u
WHERE c.unit_id = u.id
  AND c.org_id IS NULL;

-- 3e. Tables with a NOT NULL facility_id derive org_id via facilities.
UPDATE public.daily_operations d
SET org_id = f.org_id
FROM public.facilities f
WHERE d.facility_id = f.id
  AND d.org_id IS NULL;

UPDATE public.service_development_entries s
SET org_id = f.org_id
FROM public.facilities f
WHERE s.facility_id = f.id
  AND s.org_id IS NULL;

UPDATE public.iop_patients i
SET org_id = f.org_id
FROM public.facilities f
WHERE i.facility_id = f.id
  AND i.org_id IS NULL;

UPDATE public.program_ranking_daily_actuals p
SET org_id = f.org_id
FROM public.facilities f
WHERE p.facility_id = f.id
  AND p.org_id IS NULL;

-- 3f. Safety net: catch any stray orphan rows (e.g. rows whose parent
-- facility/unit was somehow missing or null) on ALL 12 tables so the
-- SET NOT NULL statements in step 5 can never fail.
UPDATE public.facilities                     SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.budget_years                    SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.budget_sections                  SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.budget_rows                     SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.budgets                         SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.actual_entries                   SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.units                           SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.daily_operations                 SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.service_development_entries       SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.iop_patients                    SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.unit_budget_config               SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.program_ranking_daily_actuals      SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;


-- =============================================================================
-- 4. Copy user_roles -> org_members (compat)
-- =============================================================================
-- public.user_roles remains the authoritative table for role checks (via
-- public.has_role / public.get_user_role) and is intentionally left in
-- place — it is only retired in Phase 3. This copy just seeds org_members so
-- Phase 2's org-scoped RLS policies have membership data to work with from
-- day one. Pick the single highest-priority role per user (admin > editor >
-- everything else) so the org_members unique(org_id, user_id) is satisfied.
INSERT INTO public.org_members (org_id, user_id, role)
SELECT DISTINCT ON (user_id) '00000000-0000-0000-0000-000000000001', user_id, role
FROM public.user_roles
ORDER BY user_id, (role = 'admin'::public.app_role) DESC, (role = 'editor'::public.app_role) DESC
ON CONFLICT (org_id, user_id) DO NOTHING;


-- =============================================================================
-- 5. SET NOT NULL on org_id for all 12 tenant tables
-- =============================================================================

ALTER TABLE public.facilities                     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.budget_years                    ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.budget_sections                  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.budget_rows                     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.budgets                         ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.actual_entries                   ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.units                           ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.daily_operations                 ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.service_development_entries       ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.iop_patients                    ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.unit_budget_config               ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.program_ranking_daily_actuals      ALTER COLUMN org_id SET NOT NULL;


-- =============================================================================
-- 6. Replace global uniques with org-composite uniques
-- =============================================================================
-- Constraint names below were confirmed against the migrations that created
-- them (see report), not guessed:
--   - facilities.code   -> UNIQUE column constraint, auto-named
--                          facilities_code_key
--                          (supabase/migrations/20251222155100_...sql)
--   - budget_years.year -> UNIQUE column constraint, auto-named
--                          budget_years_year_key
--                          (supabase/migrations/20251222155100_...sql)
--   - budget_rows.row_key -> UNIQUE column constraint, auto-named
--                          budget_rows_row_key_key
--                          (supabase/migrations/20251222155100_...sql)
--   - budgets unique index -> idx_budgets_unique_entry
--                          ON public.budgets (unit_id, budget_year_id, month, row_id)
--                          (supabase/migrations/20251230142315_...sql)

ALTER TABLE public.facilities
  DROP CONSTRAINT IF EXISTS facilities_code_key;
ALTER TABLE public.facilities
  ADD CONSTRAINT facilities_org_id_code_key UNIQUE (org_id, code);

ALTER TABLE public.budget_years
  DROP CONSTRAINT IF EXISTS budget_years_year_key;
ALTER TABLE public.budget_years
  ADD CONSTRAINT budget_years_org_id_year_key UNIQUE (org_id, year);

ALTER TABLE public.budget_rows
  DROP CONSTRAINT IF EXISTS budget_rows_row_key_key;
ALTER TABLE public.budget_rows
  ADD CONSTRAINT budget_rows_org_id_row_key_key UNIQUE (org_id, row_key);

DROP INDEX IF EXISTS public.idx_budgets_unique_entry;
CREATE UNIQUE INDEX idx_budgets_unique_entry
  ON public.budgets (org_id, unit_id, budget_year_id, month, row_id);

-- All other tenant tables' existing composite uniques already include
-- unit_id or facility_id (e.g. units(facility_id, name),
-- service_development_entries(unit_id, date, territory, metric_name),
-- unit_budget_config(unit_id), program_ranking_daily_actuals(unit_id, date),
-- idx_actual_entries_unique_entry(unit_id, date, row_id),
-- idx_daily_operations_unique_entry(unit_id, date)) and are therefore
-- already transitively org-scoped — left untouched.


-- =============================================================================
-- 7. Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_facilities_org_id                     ON public.facilities(org_id);
CREATE INDEX IF NOT EXISTS idx_budget_years_org_id                    ON public.budget_years(org_id);
CREATE INDEX IF NOT EXISTS idx_budget_sections_org_id                  ON public.budget_sections(org_id);
CREATE INDEX IF NOT EXISTS idx_budget_rows_org_id                     ON public.budget_rows(org_id);
CREATE INDEX IF NOT EXISTS idx_budgets_org_id                         ON public.budgets(org_id);
CREATE INDEX IF NOT EXISTS idx_actual_entries_org_id                   ON public.actual_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_units_org_id                           ON public.units(org_id);
CREATE INDEX IF NOT EXISTS idx_daily_operations_org_id                 ON public.daily_operations(org_id);
CREATE INDEX IF NOT EXISTS idx_service_development_entries_org_id       ON public.service_development_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_iop_patients_org_id                    ON public.iop_patients(org_id);
CREATE INDEX IF NOT EXISTS idx_unit_budget_config_org_id               ON public.unit_budget_config(org_id);
CREATE INDEX IF NOT EXISTS idx_program_ranking_daily_actuals_org_id      ON public.program_ranking_daily_actuals(org_id);

CREATE INDEX IF NOT EXISTS idx_actual_entries_org_date ON public.actual_entries(org_id, date);
