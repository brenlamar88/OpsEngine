-- Add iop_daily_enrolled_total to daily_operations table
ALTER TABLE public.daily_operations
ADD COLUMN iop_daily_enrolled_total integer NOT NULL DEFAULT 0;