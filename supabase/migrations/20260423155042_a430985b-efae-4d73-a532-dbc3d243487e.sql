CREATE TABLE public.program_ranking_daily_actuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  actual_value NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT program_ranking_daily_actuals_unit_date_key UNIQUE (unit_id, date)
);

CREATE INDEX idx_program_ranking_daily_actuals_date
  ON public.program_ranking_daily_actuals(date);

CREATE INDEX idx_program_ranking_daily_actuals_facility_date
  ON public.program_ranking_daily_actuals(facility_id, date);

ALTER TABLE public.program_ranking_daily_actuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible ranking daily actuals"
ON public.program_ranking_daily_actuals
FOR SELECT
TO authenticated
USING (public.user_can_view_facility(auth.uid(), facility_id));

CREATE POLICY "Edit roles can insert accessible ranking daily actuals"
ON public.program_ranking_daily_actuals
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_can_view_facility(auth.uid(), facility_id)
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
    OR public.has_role(auth.uid(), 'nursing')
    OR public.has_role(auth.uid(), 'service_development')
    OR public.has_role(auth.uid(), 'program_administrator')
    OR public.has_role(auth.uid(), 'adon')
    OR public.has_role(auth.uid(), 'don')
    OR public.has_role(auth.uid(), 'him')
    OR public.has_role(auth.uid(), 'sdd')
  )
);

CREATE POLICY "Edit roles can update accessible ranking daily actuals"
ON public.program_ranking_daily_actuals
FOR UPDATE
TO authenticated
USING (
  public.user_can_view_facility(auth.uid(), facility_id)
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
    OR public.has_role(auth.uid(), 'nursing')
    OR public.has_role(auth.uid(), 'service_development')
    OR public.has_role(auth.uid(), 'program_administrator')
    OR public.has_role(auth.uid(), 'adon')
    OR public.has_role(auth.uid(), 'don')
    OR public.has_role(auth.uid(), 'him')
    OR public.has_role(auth.uid(), 'sdd')
  )
)
WITH CHECK (
  public.user_can_view_facility(auth.uid(), facility_id)
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'editor')
    OR public.has_role(auth.uid(), 'nursing')
    OR public.has_role(auth.uid(), 'service_development')
    OR public.has_role(auth.uid(), 'program_administrator')
    OR public.has_role(auth.uid(), 'adon')
    OR public.has_role(auth.uid(), 'don')
    OR public.has_role(auth.uid(), 'him')
    OR public.has_role(auth.uid(), 'sdd')
  )
);

CREATE POLICY "Admins can delete ranking daily actuals"
ON public.program_ranking_daily_actuals
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_program_ranking_daily_actuals_updated_at
BEFORE UPDATE ON public.program_ranking_daily_actuals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();