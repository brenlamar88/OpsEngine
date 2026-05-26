-- Update the units_unit_type_check constraint to allow LTAC and RHC
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_unit_type_check;

ALTER TABLE public.units ADD CONSTRAINT units_unit_type_check 
CHECK (unit_type = ANY (ARRAY['INPATIENT'::text, 'IOP'::text, 'LTAC'::text, 'RHC'::text]));