-- =============================================================================
-- Fix: propagate org_id in sync_program_ranking_daily_actuals_from_daily_operations
-- =============================================================================
-- Regression: public.sync_program_ranking_daily_actuals_from_daily_operations()
-- (created in 20260423161206_...sql, re-created identically in
-- 20260423164728_...sql) is an AFTER INSERT/UPDATE trigger on
-- public.daily_operations that inserts/upserts a row into
-- public.program_ranking_daily_actuals WITHOUT setting org_id.
--
-- Phase 1 of the multi-tenant migration (20260718120000_...sql) added
-- org_id to program_ranking_daily_actuals and made it NOT NULL. That
-- migration did not touch this trigger function, so on current migrations
-- ANY insert or update on public.daily_operations fails with:
--   null value in column "org_id" of relation "program_ranking_daily_actuals"
--   violates not-null constraint
--
-- This migration re-creates the function with its logic otherwise
-- untouched (same unit_type lookup, same IOP-vs-census computation, same
-- ON CONFLICT (unit_id, date) upsert target, same SECURITY DEFINER /
-- search_path attributes, same trigger wiring) and adds org_id, sourced
-- from NEW.org_id (the daily_operations row's own org_id, itself NOT NULL
-- since Phase 1), to both the INSERT column list and the ON CONFLICT
-- DO UPDATE SET clause so re-synced rows can't be left with a stale org_id.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_program_ranking_daily_actuals_from_daily_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_unit_type text;
  computed_actual numeric;
  computed_source text;
BEGIN
  SELECT unit_type
  INTO target_unit_type
  FROM public.units
  WHERE id = NEW.unit_id;

  IF target_unit_type IS NULL THEN
    RETURN NEW;
  END IF;

  IF upper(target_unit_type) = 'IOP' THEN
    computed_actual := COALESCE(NEW.iop_daily_enrolled_total, 0);
    computed_source := 'iop_daily_enrolled_total';
  ELSE
    computed_actual :=
      COALESCE(NEW.mcr_full_days, 0)
      + COALESCE(NEW.mcr_co_days, 0)
      + COALESCE(NEW.mcr_lifetime_days, 0)
      + COALESCE(NEW.hmo_pt_days, 0)
      + COALESCE(NEW.medicaid_pt_days, 0)
      + COALESCE(NEW.commercial_pt_days, 0)
      + COALESCE(NEW.private_pay_pt_days, 0)
      + COALESCE(NEW.charity_indigent_pt_days, 0);
    computed_source := 'daily_operations_total_census';
  END IF;

  INSERT INTO public.program_ranking_daily_actuals (
    facility_id,
    unit_id,
    date,
    actual_value,
    source,
    org_id
  )
  VALUES (
    NEW.facility_id,
    NEW.unit_id,
    NEW.date,
    computed_actual,
    computed_source,
    NEW.org_id
  )
  ON CONFLICT (unit_id, date)
  DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    actual_value = EXCLUDED.actual_value,
    source = EXCLUDED.source,
    org_id = EXCLUDED.org_id,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Trigger wiring is unchanged (same AFTER INSERT OR UPDATE, same function),
-- re-stated here only for clarity; CREATE OR REPLACE FUNCTION above already
-- takes effect for the existing trigger without needing to re-create it.
