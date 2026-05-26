
-- Drop the admin-only delete policy
DROP POLICY IF EXISTS "Admins can delete service_development_entries" ON public.service_development_entries;

-- Create new delete policy for all edit-capable roles
CREATE POLICY "Edit roles can delete service_development_entries"
ON public.service_development_entries FOR DELETE
TO public
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
