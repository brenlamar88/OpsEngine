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
    source
  )
  VALUES (
    NEW.facility_id,
    NEW.unit_id,
    NEW.date,
    computed_actual,
    computed_source
  )
  ON CONFLICT (unit_id, date)
  DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    actual_value = EXCLUDED.actual_value,
    source = EXCLUDED.source,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_program_ranking_daily_actuals_on_daily_operations ON public.daily_operations;

CREATE TRIGGER sync_program_ranking_daily_actuals_on_daily_operations
AFTER INSERT OR UPDATE ON public.daily_operations
FOR EACH ROW
EXECUTE FUNCTION public.sync_program_ranking_daily_actuals_from_daily_operations();