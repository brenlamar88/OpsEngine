-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');

-- Create data_type enum for budget rows
CREATE TYPE public.data_type AS ENUM ('currency', 'integer', 'percent', 'decimal');

-- Create entry_mode enum for budget rows
CREATE TYPE public.entry_mode AS ENUM ('budget_only', 'actual_only', 'both');

-- Create calculation_type enum for budget rows
CREATE TYPE public.calculation_type AS ENUM ('manual', 'calculated');

-- Create entry_status enum for actual entries
CREATE TYPE public.entry_status AS ENUM ('draft', 'submitted');

-- Facilities table (optional multi-facility support)
CREATE TABLE public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget years table
CREATE TABLE public.budget_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget sections table
CREATE TABLE public.budget_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget rows (line items) table
CREATE TABLE public.budget_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.budget_sections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  row_key TEXT NOT NULL UNIQUE,
  data_type public.data_type NOT NULL DEFAULT 'currency',
  entry_mode public.entry_mode NOT NULL DEFAULT 'both',
  calculation_type public.calculation_type NOT NULL DEFAULT 'manual',
  formula TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budgets table (monthly budgets per row)
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  budget_year_id UUID NOT NULL REFERENCES public.budget_years(id) ON DELETE CASCADE,
  row_id UUID NOT NULL REFERENCES public.budget_rows(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  value NUMERIC NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id, budget_year_id, row_id, month)
);

-- Actual entries table (daily actual values per row)
CREATE TABLE public.actual_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  budget_year_id UUID NOT NULL REFERENCES public.budget_years(id) ON DELETE CASCADE,
  row_id UUID NOT NULL REFERENCES public.budget_rows(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  submitted_by UUID NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.entry_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Profiles table for user info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actual_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's highest role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'admin' THEN 1 
      WHEN 'editor' THEN 2 
      WHEN 'viewer' THEN 3 
    END
  LIMIT 1
$$;

-- Trigger function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  
  -- Assign default viewer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add update triggers
CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON public.facilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budget_years_updated_at BEFORE UPDATE ON public.budget_years FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budget_sections_updated_at BEFORE UPDATE ON public.budget_sections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budget_rows_updated_at BEFORE UPDATE ON public.budget_rows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_actual_entries_updated_at BEFORE UPDATE ON public.actual_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: Users can view all profiles, update own
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles: Only admins can manage, users can view own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Facilities: All authenticated can view, admins can manage
CREATE POLICY "All users can view facilities" ON public.facilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert facilities" ON public.facilities FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update facilities" ON public.facilities FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete facilities" ON public.facilities FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Budget years: All authenticated can view, admins can manage
CREATE POLICY "All users can view budget_years" ON public.budget_years FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert budget_years" ON public.budget_years FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update budget_years" ON public.budget_years FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete budget_years" ON public.budget_years FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Budget sections: All authenticated can view, admins can manage
CREATE POLICY "All users can view budget_sections" ON public.budget_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert budget_sections" ON public.budget_sections FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update budget_sections" ON public.budget_sections FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete budget_sections" ON public.budget_sections FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Budget rows: All authenticated can view, admins can manage
CREATE POLICY "All users can view budget_rows" ON public.budget_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert budget_rows" ON public.budget_rows FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update budget_rows" ON public.budget_rows FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete budget_rows" ON public.budget_rows FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Budgets: All authenticated can view, editors/admins can manage
CREATE POLICY "All users can view budgets" ON public.budgets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert budgets" ON public.budgets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors can update budgets" ON public.budgets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "Admins can delete budgets" ON public.budgets FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Actual entries: All authenticated can view, editors/admins can manage own
CREATE POLICY "All users can view actual_entries" ON public.actual_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Editors can insert actual_entries" ON public.actual_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "Users can update own actual_entries" ON public.actual_entries FOR UPDATE TO authenticated USING (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete actual_entries" ON public.actual_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));