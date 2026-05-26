-- Add IOP-specific fields to daily_operations table
ALTER TABLE public.daily_operations
ADD COLUMN IF NOT EXISTS iop_daily_groups_billed integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS iop_daily_attendance_total integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS iop_daily_meals_total integer NOT NULL DEFAULT 0;

-- Add IOP budget rate to unit_budget_config table
ALTER TABLE public.unit_budget_config
ADD COLUMN IF NOT EXISTS rate_per_group numeric NOT NULL DEFAULT 0;