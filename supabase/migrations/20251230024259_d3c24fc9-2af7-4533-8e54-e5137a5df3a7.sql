-- Add budget revenue rate columns to daily_operations
ALTER TABLE public.daily_operations 
ADD COLUMN IF NOT EXISTS rate_mcr_full_days numeric NOT NULL DEFAULT 955,
ADD COLUMN IF NOT EXISTS rate_mcr_co_days numeric NOT NULL DEFAULT 536,
ADD COLUMN IF NOT EXISTS rate_mcr_lifetime_days numeric NOT NULL DEFAULT 117,
ADD COLUMN IF NOT EXISTS rate_hmo numeric NOT NULL DEFAULT 900,
ADD COLUMN IF NOT EXISTS rate_medicaid numeric NOT NULL DEFAULT 737,
ADD COLUMN IF NOT EXISTS rate_commercial numeric NOT NULL DEFAULT 800,
ADD COLUMN IF NOT EXISTS rate_private_pay numeric NOT NULL DEFAULT 800,
ADD COLUMN IF NOT EXISTS rate_charity_indigent numeric NOT NULL DEFAULT 0;