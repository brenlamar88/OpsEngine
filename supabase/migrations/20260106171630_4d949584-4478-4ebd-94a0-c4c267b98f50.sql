-- Update RLS policies for daily_operations to include new roles
DROP POLICY IF EXISTS "Edit roles can insert daily_operations" ON public.daily_operations;
CREATE POLICY "Edit roles can insert daily_operations" 
ON public.daily_operations 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR 
  has_role(auth.uid(), 'nursing'::app_role) OR 
  has_role(auth.uid(), 'service_development'::app_role) OR 
  has_role(auth.uid(), 'program_administrator'::app_role) OR
  has_role(auth.uid(), 'adon'::app_role) OR
  has_role(auth.uid(), 'don'::app_role) OR
  has_role(auth.uid(), 'him'::app_role) OR
  has_role(auth.uid(), 'sdd'::app_role)
);

DROP POLICY IF EXISTS "Edit roles can update daily_operations" ON public.daily_operations;
CREATE POLICY "Edit roles can update daily_operations" 
ON public.daily_operations 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR 
  has_role(auth.uid(), 'nursing'::app_role) OR 
  has_role(auth.uid(), 'service_development'::app_role) OR 
  has_role(auth.uid(), 'program_administrator'::app_role) OR
  has_role(auth.uid(), 'adon'::app_role) OR
  has_role(auth.uid(), 'don'::app_role) OR
  has_role(auth.uid(), 'him'::app_role) OR
  has_role(auth.uid(), 'sdd'::app_role)
);

-- Update RLS policies for actual_entries to include new roles
DROP POLICY IF EXISTS "Edit roles can insert actual_entries" ON public.actual_entries;
CREATE POLICY "Edit roles can insert actual_entries" 
ON public.actual_entries 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR 
  has_role(auth.uid(), 'nursing'::app_role) OR 
  has_role(auth.uid(), 'service_development'::app_role) OR 
  has_role(auth.uid(), 'program_administrator'::app_role) OR
  has_role(auth.uid(), 'adon'::app_role) OR
  has_role(auth.uid(), 'don'::app_role) OR
  has_role(auth.uid(), 'him'::app_role) OR
  has_role(auth.uid(), 'sdd'::app_role)
);

DROP POLICY IF EXISTS "Edit roles can update actual_entries" ON public.actual_entries;
CREATE POLICY "Edit roles can update actual_entries" 
ON public.actual_entries 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR 
  has_role(auth.uid(), 'nursing'::app_role) OR 
  has_role(auth.uid(), 'service_development'::app_role) OR 
  has_role(auth.uid(), 'program_administrator'::app_role) OR
  has_role(auth.uid(), 'adon'::app_role) OR
  has_role(auth.uid(), 'don'::app_role) OR
  has_role(auth.uid(), 'him'::app_role) OR
  has_role(auth.uid(), 'sdd'::app_role)
);

-- Update RLS policies for service_development_entries to include new roles
DROP POLICY IF EXISTS "Edit roles can insert service_development_entries" ON public.service_development_entries;
CREATE POLICY "Edit roles can insert service_development_entries" 
ON public.service_development_entries 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR 
  has_role(auth.uid(), 'nursing'::app_role) OR 
  has_role(auth.uid(), 'service_development'::app_role) OR 
  has_role(auth.uid(), 'program_administrator'::app_role) OR
  has_role(auth.uid(), 'adon'::app_role) OR
  has_role(auth.uid(), 'don'::app_role) OR
  has_role(auth.uid(), 'him'::app_role) OR
  has_role(auth.uid(), 'sdd'::app_role)
);

DROP POLICY IF EXISTS "Edit roles can update service_development_entries" ON public.service_development_entries;
CREATE POLICY "Edit roles can update service_development_entries" 
ON public.service_development_entries 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR 
  has_role(auth.uid(), 'nursing'::app_role) OR 
  has_role(auth.uid(), 'service_development'::app_role) OR 
  has_role(auth.uid(), 'program_administrator'::app_role) OR
  has_role(auth.uid(), 'adon'::app_role) OR
  has_role(auth.uid(), 'don'::app_role) OR
  has_role(auth.uid(), 'him'::app_role) OR
  has_role(auth.uid(), 'sdd'::app_role)
);

-- Update RLS policies for iop_patients to include new roles
DROP POLICY IF EXISTS "Edit roles can insert iop_patients" ON public.iop_patients;
CREATE POLICY "Edit roles can insert iop_patients" 
ON public.iop_patients 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR 
  has_role(auth.uid(), 'nursing'::app_role) OR 
  has_role(auth.uid(), 'service_development'::app_role) OR 
  has_role(auth.uid(), 'program_administrator'::app_role) OR
  has_role(auth.uid(), 'adon'::app_role) OR
  has_role(auth.uid(), 'don'::app_role) OR
  has_role(auth.uid(), 'him'::app_role) OR
  has_role(auth.uid(), 'sdd'::app_role)
);

DROP POLICY IF EXISTS "Edit roles can update iop_patients" ON public.iop_patients;
CREATE POLICY "Edit roles can update iop_patients" 
ON public.iop_patients 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR 
  has_role(auth.uid(), 'nursing'::app_role) OR 
  has_role(auth.uid(), 'service_development'::app_role) OR 
  has_role(auth.uid(), 'program_administrator'::app_role) OR
  has_role(auth.uid(), 'adon'::app_role) OR
  has_role(auth.uid(), 'don'::app_role) OR
  has_role(auth.uid(), 'him'::app_role) OR
  has_role(auth.uid(), 'sdd'::app_role)
);

DROP POLICY IF EXISTS "Edit roles can delete iop_patients" ON public.iop_patients;
CREATE POLICY "Edit roles can delete iop_patients" 
ON public.iop_patients 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR 
  has_role(auth.uid(), 'nursing'::app_role) OR 
  has_role(auth.uid(), 'service_development'::app_role) OR 
  has_role(auth.uid(), 'program_administrator'::app_role) OR
  has_role(auth.uid(), 'adon'::app_role) OR
  has_role(auth.uid(), 'don'::app_role) OR
  has_role(auth.uid(), 'him'::app_role) OR
  has_role(auth.uid(), 'sdd'::app_role)
);