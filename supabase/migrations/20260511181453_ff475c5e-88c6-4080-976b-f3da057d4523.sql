ALTER TABLE public.daily_operations
  ADD COLUMN IF NOT EXISTS clean_census numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clean_census_variance_why text NOT NULL DEFAULT '';