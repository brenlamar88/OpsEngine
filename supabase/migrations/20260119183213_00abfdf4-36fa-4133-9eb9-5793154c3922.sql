-- Add ELMHS columns to daily_operations table
ALTER TABLE public.daily_operations
ADD COLUMN IF NOT EXISTS elmhs_pt_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rate_elmhs NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS elmhs_rev NUMERIC(12, 2) DEFAULT 0;

-- Add ELMHS rate column to unit_budget_config table
ALTER TABLE public.unit_budget_config
ADD COLUMN IF NOT EXISTS rate_elmhs NUMERIC(10, 2) DEFAULT 0;