-- Drop and recreate the INSERT policy with proper targeting for authenticated users
DROP POLICY IF EXISTS "Edit roles can insert iop_patients" ON public.iop_patients;

CREATE POLICY "Edit roles can insert iop_patients" 
ON public.iop_patients 
FOR INSERT 
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'editor'::app_role) OR 
  public.has_role(auth.uid(), 'nursing'::app_role) OR 
  public.has_role(auth.uid(), 'service_development'::app_role) OR 
  public.has_role(auth.uid(), 'program_administrator'::app_role) OR 
  public.has_role(auth.uid(), 'adon'::app_role) OR 
  public.has_role(auth.uid(), 'don'::app_role) OR 
  public.has_role(auth.uid(), 'him'::app_role) OR 
  public.has_role(auth.uid(), 'sdd'::app_role)
);

-- Also fix UPDATE and DELETE policies to target authenticated users
DROP POLICY IF EXISTS "Edit roles can update iop_patients" ON public.iop_patients;

CREATE POLICY "Edit roles can update iop_patients" 
ON public.iop_patients 
FOR UPDATE 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'editor'::app_role) OR 
  public.has_role(auth.uid(), 'nursing'::app_role) OR 
  public.has_role(auth.uid(), 'service_development'::app_role) OR 
  public.has_role(auth.uid(), 'program_administrator'::app_role) OR 
  public.has_role(auth.uid(), 'adon'::app_role) OR 
  public.has_role(auth.uid(), 'don'::app_role) OR 
  public.has_role(auth.uid(), 'him'::app_role) OR 
  public.has_role(auth.uid(), 'sdd'::app_role)
);

DROP POLICY IF EXISTS "Edit roles can delete iop_patients" ON public.iop_patients;

CREATE POLICY "Edit roles can delete iop_patients" 
ON public.iop_patients 
FOR DELETE 
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR 
  public.has_role(auth.uid(), 'editor'::app_role) OR 
  public.has_role(auth.uid(), 'nursing'::app_role) OR 
  public.has_role(auth.uid(), 'service_development'::app_role) OR 
  public.has_role(auth.uid(), 'program_administrator'::app_role) OR 
  public.has_role(auth.uid(), 'adon'::app_role) OR 
  public.has_role(auth.uid(), 'don'::app_role) OR 
  public.has_role(auth.uid(), 'him'::app_role) OR 
  public.has_role(auth.uid(), 'sdd'::app_role)
);