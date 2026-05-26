-- Add initial_cert_why column for explanation when Initial Certs < Admits
ALTER TABLE public.daily_operations 
ADD COLUMN IF NOT EXISTS initial_cert_why text DEFAULT '';