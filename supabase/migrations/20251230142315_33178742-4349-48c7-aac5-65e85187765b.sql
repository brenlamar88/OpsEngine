-- Delete duplicate budget rows where facility_id is null 
-- (these are duplicates of existing rows with a facility_id)
DELETE FROM public.budgets WHERE facility_id IS NULL;

-- Delete duplicate actual_entries where facility_id is null
DELETE FROM public.actual_entries WHERE facility_id IS NULL;

-- Now set NOT NULL constraints 
ALTER TABLE public.budgets ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.actual_entries ALTER COLUMN unit_id SET NOT NULL;
ALTER TABLE public.daily_operations ALTER COLUMN unit_id SET NOT NULL;

-- Add unique constraints to prevent duplicates
CREATE UNIQUE INDEX idx_budgets_unique_entry 
ON public.budgets (unit_id, budget_year_id, month, row_id);

CREATE UNIQUE INDEX idx_actual_entries_unique_entry 
ON public.actual_entries (unit_id, date, row_id);

CREATE UNIQUE INDEX idx_daily_operations_unique_entry 
ON public.daily_operations (unit_id, date);

-- Add indexes for faster lookups
CREATE INDEX idx_units_facility_id ON public.units(facility_id);
CREATE INDEX idx_budgets_unit_id ON public.budgets(unit_id);
CREATE INDEX idx_actual_entries_unit_id ON public.actual_entries(unit_id);
CREATE INDEX idx_daily_operations_unit_id ON public.daily_operations(unit_id);