-- Create service_development_entries table for territory-specific data
CREATE TABLE public.service_development_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id uuid NOT NULL REFERENCES facilities(id),
  unit_id uuid NOT NULL REFERENCES units(id),
  date date NOT NULL,
  territory text NOT NULL CHECK (territory IN ('Red', 'White', 'Blue')),
  metric_name text NOT NULL,
  numeric_value numeric NOT NULL DEFAULT 0,
  text_value text,
  submitted_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(unit_id, date, territory, metric_name)
);

-- Enable RLS
ALTER TABLE public.service_development_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "All users can view service_development_entries" 
ON public.service_development_entries 
FOR SELECT 
USING (true);

CREATE POLICY "Editors can insert service_development_entries" 
ON public.service_development_entries 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Users can update own service_development_entries" 
ON public.service_development_entries 
FOR UPDATE 
USING ((submitted_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete service_development_entries" 
ON public.service_development_entries 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_service_development_entries_updated_at
BEFORE UPDATE ON public.service_development_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing territory admits data from daily_operations
-- Red Territory Admits
INSERT INTO public.service_development_entries (facility_id, unit_id, date, territory, metric_name, numeric_value, submitted_by)
SELECT facility_id, unit_id, date, 'Red', 'admits', red_territory_admits, submitted_by
FROM public.daily_operations
WHERE red_territory_admits > 0;

-- White Territory Admits
INSERT INTO public.service_development_entries (facility_id, unit_id, date, territory, metric_name, numeric_value, submitted_by)
SELECT facility_id, unit_id, date, 'White', 'admits', white_territory_admits, submitted_by
FROM public.daily_operations
WHERE white_territory_admits > 0;

-- Blue Territory Admits
INSERT INTO public.service_development_entries (facility_id, unit_id, date, territory, metric_name, numeric_value, submitted_by)
SELECT facility_id, unit_id, date, 'Blue', 'admits', blue_territory_admits, submitted_by
FROM public.daily_operations
WHERE blue_territory_admits > 0;