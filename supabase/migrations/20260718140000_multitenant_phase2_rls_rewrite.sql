-- =============================================================================
-- Multi-tenant migration — Phase 2: RLS rewrite
-- =============================================================================
-- Phase 1 (20260718120000) added org_id (NOT NULL) to every tenant-scoped
-- table but deliberately shipped NO policy changes, so the app kept working
-- as a single-tenant system in the interim. This migration is Phase 2: it
-- replaces every blanket `USING (true)` / global-role policy on the 12
-- tenant tables (and profiles) with org-scoped equivalents, and adds RLS to
-- the two Phase 1 tables (organizations, org_members) that were created with
-- RLS enabled but no policies yet.
--
-- Every DROP POLICY below targets the exact, currently-effective policy name
-- as verified in docs/inventory/rls-policies.md (cross-checked directly
-- against the migration that created/last-replaced each policy). For every
-- table, the DROP and the replacement CREATE happen back-to-back in this
-- same transaction/migration file, so there is never a window where the
-- table has no applicable policy.
--
-- public.user_roles and public.has_role/get_user_role are left completely
-- untouched — they remain the compat path used by parts of the app until
-- Phase 3 retires them. public.user_can_view_facility (20260127161057) is
-- also left untouched and is reused as-is for the facility dimension of
-- program_ranking_daily_actuals.
-- =============================================================================


-- =============================================================================
-- 1. SECURITY DEFINER helper functions
-- =============================================================================
-- All STABLE + SECURITY DEFINER + SET search_path = public, matching the
-- style of public.has_role (20251222155100). SECURITY DEFINER is required
-- (and intentional) here: it lets these functions read public.org_members
-- while evaluating a policy ON public.org_members itself without recursing
-- back through RLS — org_members' own policies (section 4 below) call
-- is_org_member/is_org_admin, and since those functions bypass RLS via
-- SECURITY DEFINER, there is no infinite recursion.

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE org_id = _org_id
      AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE org_id = _org_id
      AND user_id = auth.uid()
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_org_role(_org_id, 'admin'::public.app_role)
$$;

-- True if the caller (auth.uid()) and _user_id are both members of at least
-- one common organization. Used to scope profile visibility to org-mates
-- instead of every authenticated user.
CREATE OR REPLACE FUNCTION public.shares_org_with(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members om_self
    JOIN public.org_members om_other
      ON om_other.org_id = om_self.org_id
    WHERE om_self.user_id = auth.uid()
      AND om_other.user_id = _user_id
  )
$$;

-- The 9-role "edit roles" set used across actual_entries, daily_operations,
-- service_development_entries, iop_patients, and program_ranking_daily_actuals
-- pre-Phase-2 (see docs/inventory/rls-policies.md EDIT_ROLES definition),
-- reimplemented as an org-scoped membership-role check.
CREATE OR REPLACE FUNCTION public.has_org_edit_role(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members
    WHERE org_id = _org_id
      AND user_id = auth.uid()
      AND role IN (
        'admin'::public.app_role,
        'editor'::public.app_role,
        'nursing'::public.app_role,
        'service_development'::public.app_role,
        'program_administrator'::public.app_role,
        'adon'::public.app_role,
        'don'::public.app_role,
        'him'::public.app_role,
        'sdd'::public.app_role
      )
  )
$$;

-- public.user_can_view_facility (20260127161057) is left untouched and
-- reused as-is below.


-- =============================================================================
-- 2. Policy rewrite on the 12 tenant tables
-- =============================================================================

-- --- facilities --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view facilities" ON public.facilities;
DROP POLICY IF EXISTS "Admins can insert facilities" ON public.facilities;
DROP POLICY IF EXISTS "Admins can update facilities" ON public.facilities;
DROP POLICY IF EXISTS "Admins can delete facilities" ON public.facilities;

CREATE POLICY "Org members can view facilities" ON public.facilities
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org admins can insert facilities" ON public.facilities
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Org admins can update facilities" ON public.facilities
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id));

CREATE POLICY "Org admins can delete facilities" ON public.facilities
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- --- budget_years --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view budget_years" ON public.budget_years;
DROP POLICY IF EXISTS "Admins can insert budget_years" ON public.budget_years;
DROP POLICY IF EXISTS "Admins can update budget_years" ON public.budget_years;
DROP POLICY IF EXISTS "Admins can delete budget_years" ON public.budget_years;

CREATE POLICY "Org members can view budget_years" ON public.budget_years
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org admins can insert budget_years" ON public.budget_years
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Org admins can update budget_years" ON public.budget_years
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id));

CREATE POLICY "Org admins can delete budget_years" ON public.budget_years
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- --- budget_sections --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view budget_sections" ON public.budget_sections;
DROP POLICY IF EXISTS "Admins can insert budget_sections" ON public.budget_sections;
DROP POLICY IF EXISTS "Admins can update budget_sections" ON public.budget_sections;
DROP POLICY IF EXISTS "Admins can delete budget_sections" ON public.budget_sections;

CREATE POLICY "Org members can view budget_sections" ON public.budget_sections
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org admins can insert budget_sections" ON public.budget_sections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Org admins can update budget_sections" ON public.budget_sections
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id));

CREATE POLICY "Org admins can delete budget_sections" ON public.budget_sections
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- --- budget_rows --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view budget_rows" ON public.budget_rows;
DROP POLICY IF EXISTS "Admins can insert budget_rows" ON public.budget_rows;
DROP POLICY IF EXISTS "Admins can update budget_rows" ON public.budget_rows;
DROP POLICY IF EXISTS "Admins can delete budget_rows" ON public.budget_rows;

CREATE POLICY "Org members can view budget_rows" ON public.budget_rows
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org admins can insert budget_rows" ON public.budget_rows
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Org admins can update budget_rows" ON public.budget_rows
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id));

CREATE POLICY "Org admins can delete budget_rows" ON public.budget_rows
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- --- budgets --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view budgets" ON public.budgets;
DROP POLICY IF EXISTS "Editors can insert budgets" ON public.budgets;
DROP POLICY IF EXISTS "Editors can update budgets" ON public.budgets;
DROP POLICY IF EXISTS "Admins can delete budgets" ON public.budgets;

CREATE POLICY "Org members can view budgets" ON public.budgets
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org editors can insert budgets" ON public.budgets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, 'admin'::public.app_role)
    OR public.has_org_role(org_id, 'editor'::public.app_role)
  );

CREATE POLICY "Org editors can update budgets" ON public.budgets
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(org_id, 'admin'::public.app_role)
    OR public.has_org_role(org_id, 'editor'::public.app_role)
  );

CREATE POLICY "Org admins can delete budgets" ON public.budgets
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- --- actual_entries --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view actual_entries" ON public.actual_entries;
DROP POLICY IF EXISTS "Edit roles can insert actual_entries" ON public.actual_entries;
DROP POLICY IF EXISTS "Edit roles can update actual_entries" ON public.actual_entries;
DROP POLICY IF EXISTS "Admins can delete actual_entries" ON public.actual_entries;

CREATE POLICY "Org members can view actual_entries" ON public.actual_entries
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org edit roles can insert actual_entries" ON public.actual_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_edit_role(org_id));

CREATE POLICY "Org edit roles can update actual_entries" ON public.actual_entries
  FOR UPDATE TO authenticated
  USING (
    (submitted_by = auth.uid() AND public.is_org_member(org_id))
    OR public.is_org_admin(org_id)
  );

CREATE POLICY "Org admins can delete actual_entries" ON public.actual_entries
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- --- units --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view units" ON public.units;
DROP POLICY IF EXISTS "Admins can insert units" ON public.units;
DROP POLICY IF EXISTS "Admins can update units" ON public.units;
DROP POLICY IF EXISTS "Admins can delete units" ON public.units;

CREATE POLICY "Org members can view units" ON public.units
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org admins can insert units" ON public.units
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Org admins can update units" ON public.units
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id));

CREATE POLICY "Org admins can delete units" ON public.units
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- --- daily_operations --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view daily_operations" ON public.daily_operations;
DROP POLICY IF EXISTS "Edit roles can insert daily_operations" ON public.daily_operations;
DROP POLICY IF EXISTS "Edit roles can update daily_operations" ON public.daily_operations;
DROP POLICY IF EXISTS "Admins can delete daily_operations" ON public.daily_operations;

CREATE POLICY "Org members can view daily_operations" ON public.daily_operations
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org edit roles can insert daily_operations" ON public.daily_operations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_edit_role(org_id));

CREATE POLICY "Org edit roles can update daily_operations" ON public.daily_operations
  FOR UPDATE TO authenticated
  USING (public.has_org_edit_role(org_id));

CREATE POLICY "Org admins can delete daily_operations" ON public.daily_operations
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- --- service_development_entries --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view service_development_entries" ON public.service_development_entries;
DROP POLICY IF EXISTS "Edit roles can insert service_development_entries" ON public.service_development_entries;
DROP POLICY IF EXISTS "Edit roles can update service_development_entries" ON public.service_development_entries;
DROP POLICY IF EXISTS "Edit roles can delete service_development_entries" ON public.service_development_entries;

CREATE POLICY "Org members can view service_development_entries" ON public.service_development_entries
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org edit roles can insert service_development_entries" ON public.service_development_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_edit_role(org_id));

CREATE POLICY "Org edit roles can update service_development_entries" ON public.service_development_entries
  FOR UPDATE TO authenticated
  USING (
    (submitted_by = auth.uid() AND public.is_org_member(org_id))
    OR public.has_org_edit_role(org_id)
  );

CREATE POLICY "Org edit roles can delete service_development_entries" ON public.service_development_entries
  FOR DELETE TO authenticated
  USING (public.has_org_edit_role(org_id));

-- --- iop_patients --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view iop_patients" ON public.iop_patients;
DROP POLICY IF EXISTS "Edit roles can insert iop_patients" ON public.iop_patients;
DROP POLICY IF EXISTS "Edit roles can update iop_patients" ON public.iop_patients;
DROP POLICY IF EXISTS "Edit roles can delete iop_patients" ON public.iop_patients;

CREATE POLICY "Org members can view iop_patients" ON public.iop_patients
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org edit roles can insert iop_patients" ON public.iop_patients
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_edit_role(org_id));

CREATE POLICY "Org edit roles can update iop_patients" ON public.iop_patients
  FOR UPDATE TO authenticated
  USING (public.has_org_edit_role(org_id));

CREATE POLICY "Org edit roles can delete iop_patients" ON public.iop_patients
  FOR DELETE TO authenticated
  USING (public.has_org_edit_role(org_id));

-- --- unit_budget_config --------------------------------------------------------------
DROP POLICY IF EXISTS "All users can view unit_budget_config" ON public.unit_budget_config;
DROP POLICY IF EXISTS "Admins can insert unit_budget_config" ON public.unit_budget_config;
DROP POLICY IF EXISTS "Admins can update unit_budget_config" ON public.unit_budget_config;
DROP POLICY IF EXISTS "Admins can delete unit_budget_config" ON public.unit_budget_config;

CREATE POLICY "Org members can view unit_budget_config" ON public.unit_budget_config
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY "Org admins can insert unit_budget_config" ON public.unit_budget_config
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Org admins can update unit_budget_config" ON public.unit_budget_config
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id));

CREATE POLICY "Org admins can delete unit_budget_config" ON public.unit_budget_config
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- --- program_ranking_daily_actuals --------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view accessible ranking daily actuals" ON public.program_ranking_daily_actuals;
DROP POLICY IF EXISTS "Edit roles can insert accessible ranking daily actuals" ON public.program_ranking_daily_actuals;
DROP POLICY IF EXISTS "Edit roles can update accessible ranking daily actuals" ON public.program_ranking_daily_actuals;
DROP POLICY IF EXISTS "Admins can delete ranking daily actuals" ON public.program_ranking_daily_actuals;

CREATE POLICY "Org members can view accessible ranking daily actuals" ON public.program_ranking_daily_actuals
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id)
    AND public.user_can_view_facility(auth.uid(), facility_id)
  );

CREATE POLICY "Org edit roles can insert accessible ranking daily actuals" ON public.program_ranking_daily_actuals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_can_view_facility(auth.uid(), facility_id)
    AND public.has_org_edit_role(org_id)
  );

CREATE POLICY "Org edit roles can update accessible ranking daily actuals" ON public.program_ranking_daily_actuals
  FOR UPDATE TO authenticated
  USING (
    public.user_can_view_facility(auth.uid(), facility_id)
    AND public.has_org_edit_role(org_id)
  )
  WITH CHECK (
    public.user_can_view_facility(auth.uid(), facility_id)
    AND public.has_org_edit_role(org_id)
  );

CREATE POLICY "Org admins can delete ranking daily actuals" ON public.program_ranking_daily_actuals
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));


-- =============================================================================
-- 3. organizations policies
-- =============================================================================
-- organizations.id IS the org id (not a foreign-key org_id column), so the
-- helpers are called with id directly. No INSERT/DELETE policy for
-- `authenticated` is added: organization creation/deletion is left to the
-- service role / a future signup function (later phase).

CREATE POLICY "Org members can view organizations" ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));

CREATE POLICY "Org admins can update organizations" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));


-- =============================================================================
-- 4. org_members policies + last-admin guard trigger
-- =============================================================================
-- is_org_member/is_org_admin are SECURITY DEFINER (section 1), so they
-- bypass org_members' own RLS when evaluated inside these very policies —
-- there is no infinite recursion.

CREATE POLICY "Members can view own org_members rows" ON public.org_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_admin(org_id));

CREATE POLICY "Org admins can insert org_members" ON public.org_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Org admins can update org_members" ON public.org_members
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id))
  WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Org admins can delete org_members" ON public.org_members
  FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id));

-- Last-admin guard: block removing (via DELETE) or demoting (via UPDATE
-- role away from 'admin') the last remaining admin of an organization, so
-- no org can ever end up with zero admins. This is a trigger rather than a
-- policy because it needs to inspect sibling rows relative to the row being
-- mutated, which RLS USING/WITH CHECK clauses evaluate per-row without that
-- context. SECURITY DEFINER so it can see all of org_members regardless of
-- the caller's own RLS-visible rows.
CREATE OR REPLACE FUNCTION public.prevent_last_org_admin_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin'::public.app_role
     AND (TG_OP = 'DELETE' OR NEW.role <> 'admin'::public.app_role) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.org_members
      WHERE org_id = OLD.org_id
        AND role = 'admin'::public.app_role
        AND id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot remove or demote the last admin of an organization';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER prevent_last_org_admin_removal
  BEFORE DELETE OR UPDATE ON public.org_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_org_admin_removal();


-- =============================================================================
-- 5. profiles
-- =============================================================================
-- Replace the blanket "view all profiles" policy with org-scoped visibility:
-- a user can see their own profile, or any profile of a user they share at
-- least one organization with. "Users can update own profile" is left
-- untouched.

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Org members can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.shares_org_with(id));


-- =============================================================================
-- 6. user_roles
-- =============================================================================
-- Intentionally untouched. public.user_roles and its policies remain the
-- compat path (source of truth for public.has_role/get_user_role) until
-- Phase 3 retires it.
