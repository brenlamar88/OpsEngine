-- Create table for IOP patients
CREATE TABLE public.iop_patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  first_name VARCHAR(3) NOT NULL,
  last_name VARCHAR(1) NOT NULL,
  admit_date DATE NOT NULL,
  discharge_date DATE,
  groups_attended INTEGER NOT NULL DEFAULT 1 CHECK (groups_attended >= 1 AND groups_attended <= 5),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.iop_patients ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All users can view iop_patients"
  ON public.iop_patients FOR SELECT
  USING (true);

CREATE POLICY "Editors can insert iop_patients"
  ON public.iop_patients FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Users can update own iop_patients"
  ON public.iop_patients FOR UPDATE
  USING ((created_by = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Editors can delete iop_patients"
  ON public.iop_patients FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));