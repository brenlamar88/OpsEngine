-- 1. Create units table
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(facility_id, name)
);

-- Enable RLS on units
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- RLS policies for units (same pattern as facilities)
CREATE POLICY "All users can view units"
ON public.units FOR SELECT
USING (true);

CREATE POLICY "Admins can insert units"
ON public.units FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update units"
ON public.units FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete units"
ON public.units FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at on units
CREATE TRIGGER update_units_updated_at
BEFORE UPDATE ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add unit_id column to budgets (nullable initially for backfill)
ALTER TABLE public.budgets ADD COLUMN unit_id uuid REFERENCES public.units(id);

-- 3. Add unit_id column to actual_entries (nullable initially for backfill)
ALTER TABLE public.actual_entries ADD COLUMN unit_id uuid REFERENCES public.units(id);

-- 4. Add unit_id column to daily_operations (nullable initially for backfill)
ALTER TABLE public.daily_operations ADD COLUMN unit_id uuid REFERENCES public.units(id);

-- 5. Create default units for each existing facility
INSERT INTO public.units (facility_id, name)
SELECT f.id, 'GERI/ADULT'
FROM public.facilities f
WHERE NOT EXISTS (
  SELECT 1 FROM public.units u WHERE u.facility_id = f.id AND u.name = 'GERI/ADULT'
);

INSERT INTO public.units (facility_id, name)
SELECT f.id, 'IOP'
FROM public.facilities f
WHERE NOT EXISTS (
  SELECT 1 FROM public.units u WHERE u.facility_id = f.id AND u.name = 'IOP'
);

-- 6. Backfill: Assign all existing budgets rows to the facility's GERI/ADULT unit
UPDATE public.budgets b
SET unit_id = (
  SELECT u.id FROM public.units u 
  WHERE u.facility_id = b.facility_id AND u.name = 'GERI/ADULT'
  LIMIT 1
)
WHERE b.unit_id IS NULL AND b.facility_id IS NOT NULL;

-- 7. Backfill: Assign all existing actual_entries rows to the facility's GERI/ADULT unit
UPDATE public.actual_entries ae
SET unit_id = (
  SELECT u.id FROM public.units u 
  WHERE u.facility_id = ae.facility_id AND u.name = 'GERI/ADULT'
  LIMIT 1
)
WHERE ae.unit_id IS NULL AND ae.facility_id IS NOT NULL;

-- 8. Backfill: Assign all existing daily_operations rows to the facility's GERI/ADULT unit
UPDATE public.daily_operations dops
SET unit_id = (
  SELECT u.id FROM public.units u 
  WHERE u.facility_id = dops.facility_id AND u.name = 'GERI/ADULT'
  LIMIT 1
)
WHERE dops.unit_id IS NULL AND dops.facility_id IS NOT NULL;