-- Create user_facility_assignments table for facility-based access control
CREATE TABLE public.user_facility_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, facility_id)
);

-- Create user_access_settings table for "view all" corporate access
CREATE TABLE public.user_access_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  can_view_all_facilities boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.user_facility_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_facility_assignments
CREATE POLICY "Admins can view all facility assignments"
  ON public.user_facility_assignments FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own facility assignments"
  ON public.user_facility_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert facility assignments"
  ON public.user_facility_assignments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update facility assignments"
  ON public.user_facility_assignments FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete facility assignments"
  ON public.user_facility_assignments FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS policies for user_access_settings
CREATE POLICY "Admins can view all access settings"
  ON public.user_access_settings FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own access settings"
  ON public.user_access_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can insert access settings"
  ON public.user_access_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update access settings"
  ON public.user_access_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete access settings"
  ON public.user_access_settings FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at on user_access_settings
CREATE TRIGGER update_user_access_settings_updated_at
  BEFORE UPDATE ON public.user_access_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create a helper function to check if user can view a specific facility
CREATE OR REPLACE FUNCTION public.user_can_view_facility(_user_id uuid, _facility_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admins can always view all
    has_role(_user_id, 'admin')
    OR
    -- Users with "view all" setting can view all
    EXISTS (
      SELECT 1 FROM public.user_access_settings
      WHERE user_id = _user_id AND can_view_all_facilities = true
    )
    OR
    -- Users with no facility assignments can view all
    NOT EXISTS (
      SELECT 1 FROM public.user_facility_assignments
      WHERE user_id = _user_id
    )
    OR
    -- Users can view their assigned facilities
    EXISTS (
      SELECT 1 FROM public.user_facility_assignments
      WHERE user_id = _user_id AND facility_id = _facility_id
    )
$$;