-- Add Initial Cert and Recert fields to daily_operations
ALTER TABLE public.daily_operations
ADD COLUMN IF NOT EXISTS initial_cert integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS recert integer NOT NULL DEFAULT 0;