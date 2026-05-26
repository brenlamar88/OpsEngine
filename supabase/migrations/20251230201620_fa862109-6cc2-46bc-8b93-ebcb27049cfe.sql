
-- Rename existing GERI/ADULT units to ADULT (this preserves all data associations)
UPDATE public.units
SET name = 'ADULT', updated_at = now()
WHERE name = 'GERI/ADULT';

-- Create new GERI units for each facility that has an ADULT unit
INSERT INTO public.units (facility_id, name, is_active)
SELECT facility_id, 'GERI', true
FROM public.units
WHERE name = 'ADULT'
ON CONFLICT DO NOTHING;
