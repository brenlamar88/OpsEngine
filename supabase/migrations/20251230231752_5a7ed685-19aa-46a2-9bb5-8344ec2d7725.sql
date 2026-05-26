-- Add unit_type column to units table
ALTER TABLE public.units 
ADD COLUMN unit_type TEXT NOT NULL DEFAULT 'INPATIENT' 
CHECK (unit_type IN ('INPATIENT', 'IOP'));

-- Update existing units based on their name
UPDATE public.units SET unit_type = 'IOP' WHERE name = 'IOP';
UPDATE public.units SET unit_type = 'INPATIENT' WHERE name IN ('ADULT', 'GERI');