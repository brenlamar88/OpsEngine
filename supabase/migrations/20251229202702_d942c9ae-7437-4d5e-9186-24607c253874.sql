-- Create table for daily operations entries
CREATE TABLE public.daily_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  submitted_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  
  -- Service Development
  inquiries INTEGER NOT NULL DEFAULT 0,
  referrals INTEGER NOT NULL DEFAULT 0,
  red_territory_admits INTEGER NOT NULL DEFAULT 0,
  blue_territory_admits INTEGER NOT NULL DEFAULT 0,
  white_territory_admits INTEGER NOT NULL DEFAULT 0,
  face_to_face_touches INTEGER NOT NULL DEFAULT 0,
  quality_touches INTEGER NOT NULL DEFAULT 0,
  inservices INTEGER NOT NULL DEFAULT 0,
  pre_screened_by_sdrs INTEGER NOT NULL DEFAULT 0,
  needs_analysis INTEGER NOT NULL DEFAULT 0,
  top_3_categories TEXT DEFAULT '',
  discharges INTEGER NOT NULL DEFAULT 0,
  five_star_surveys INTEGER NOT NULL DEFAULT 0,

  -- Census Breakdown Pt Days
  mcr_full_days INTEGER NOT NULL DEFAULT 0,
  mcr_co_days INTEGER NOT NULL DEFAULT 0,
  mcr_lifetime_days INTEGER NOT NULL DEFAULT 0,
  hmo_pt_days INTEGER NOT NULL DEFAULT 0,
  medicaid_pt_days INTEGER NOT NULL DEFAULT 0,
  commercial_pt_days INTEGER NOT NULL DEFAULT 0,
  private_pay_pt_days INTEGER NOT NULL DEFAULT 0,
  charity_indigent_pt_days INTEGER NOT NULL DEFAULT 0,

  -- Utilization Breakdown (Revenue)
  mcr_full_days_rev NUMERIC NOT NULL DEFAULT 0,
  mcr_co_days_rev NUMERIC NOT NULL DEFAULT 0,
  mcr_lifetime_days_rev NUMERIC NOT NULL DEFAULT 0,
  hmo_rev NUMERIC NOT NULL DEFAULT 0,
  medicaid_rev NUMERIC NOT NULL DEFAULT 0,
  commercial_rev NUMERIC NOT NULL DEFAULT 0,
  private_pay_rev NUMERIC NOT NULL DEFAULT 0,
  charity_indigent_rev NUMERIC NOT NULL DEFAULT 0,
  total_deposits NUMERIC NOT NULL DEFAULT 0,

  -- Daily Staffing Hours
  rns_hours NUMERIC NOT NULL DEFAULT 0,
  lpns_hours NUMERIC NOT NULL DEFAULT 0,
  mhts_hours NUMERIC NOT NULL DEFAULT 0,
  case_manager_hours NUMERIC NOT NULL DEFAULT 0,
  housekeepers_hours NUMERIC NOT NULL DEFAULT 0,
  one_to_ones_hours NUMERIC NOT NULL DEFAULT 0,
  agency_rns_hours NUMERIC NOT NULL DEFAULT 0,
  agency_lpns_hours NUMERIC NOT NULL DEFAULT 0,
  agency_mhts_hours NUMERIC NOT NULL DEFAULT 0,
  training_non_pro_hours NUMERIC NOT NULL DEFAULT 0,
  pto_hours NUMERIC NOT NULL DEFAULT 0,

  -- Position Per Day Cost
  rns_cost NUMERIC NOT NULL DEFAULT 40,
  lpns_cost NUMERIC NOT NULL DEFAULT 25,
  mhts_cost NUMERIC NOT NULL DEFAULT 15,
  case_manager_cost NUMERIC NOT NULL DEFAULT 14.5,
  housekeepers_cost NUMERIC NOT NULL DEFAULT 12.5,
  one_to_ones_cost NUMERIC NOT NULL DEFAULT 15,
  agency_rns_cost NUMERIC NOT NULL DEFAULT 65,
  agency_lpns_cost NUMERIC NOT NULL DEFAULT 45,
  agency_mhts_cost NUMERIC NOT NULL DEFAULT 30,
  training_non_pro_cost NUMERIC NOT NULL DEFAULT 25.6,
  pto_cost NUMERIC NOT NULL DEFAULT 25.6,

  -- Employee Risk
  employees_hired NUMERIC NOT NULL DEFAULT 0,
  employees_termed NUMERIC NOT NULL DEFAULT 0,
  employees_on_pip NUMERIC NOT NULL DEFAULT 0,
  employment_claims NUMERIC NOT NULL DEFAULT 0,
  total_payroll NUMERIC NOT NULL DEFAULT 0,

  -- Expenses
  off_formulary_pharmacy_ppd NUMERIC NOT NULL DEFAULT 0,
  lab_ppd_overage NUMERIC NOT NULL DEFAULT 0,
  dietary_over_budget NUMERIC NOT NULL DEFAULT 0,
  supplies_orders_placed NUMERIC NOT NULL DEFAULT 0,
  rtbh_outside_budget_submitted NUMERIC NOT NULL DEFAULT 0,
  abnormal_expenses_notes TEXT DEFAULT '',

  -- Projected
  projected_daily_revenue NUMERIC NOT NULL DEFAULT 0,
  projected_daily_expense NUMERIC NOT NULL DEFAULT 0,
  daily_pop NUMERIC NOT NULL DEFAULT 0,
  projected_profit_loss NUMERIC NOT NULL DEFAULT 0,
  mtd_trailing_profit_loss NUMERIC NOT NULL DEFAULT 0,

  -- Quality Risk Events
  late_hp INTEGER NOT NULL DEFAULT 0,
  late_initial_treatment_plans INTEGER NOT NULL DEFAULT 0,
  late_psych_evals INTEGER NOT NULL DEFAULT 0,
  late_dc_summaries INTEGER NOT NULL DEFAULT 0,
  falls_with_injury INTEGER NOT NULL DEFAULT 0,
  falls_without_injury INTEGER NOT NULL DEFAULT 0,
  incident_report_with_injury INTEGER NOT NULL DEFAULT 0,
  incident_report_without_injury INTEGER NOT NULL DEFAULT 0,
  medication_variance INTEGER NOT NULL DEFAULT 0,
  hospital_transfers_returned INTEGER NOT NULL DEFAULT 0,
  hospital_transfers_not_returned INTEGER NOT NULL DEFAULT 0,
  restraints INTEGER NOT NULL DEFAULT 0,
  seclusions INTEGER NOT NULL DEFAULT 0,
  complaints INTEGER NOT NULL DEFAULT 0,
  grievances INTEGER NOT NULL DEFAULT 0,
  dc_against_medical_advice INTEGER NOT NULL DEFAULT 0,
  safety_rounds INTEGER NOT NULL DEFAULT 0,
  admin_chart_audits INTEGER NOT NULL DEFAULT 0,
  nursing_chart_audits INTEGER NOT NULL DEFAULT 0,
  clinical_chart_audits INTEGER NOT NULL DEFAULT 0,
  quality_chart_audits INTEGER NOT NULL DEFAULT 0,
  charts_requested INTEGER NOT NULL DEFAULT 0,
  appeals_sent INTEGER NOT NULL DEFAULT 0,
  rac_zpic_audits_open INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(facility_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_operations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "All users can view daily_operations"
ON public.daily_operations FOR SELECT
USING (true);

CREATE POLICY "Editors can insert daily_operations"
ON public.daily_operations FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Users can update own daily_operations"
ON public.daily_operations FOR UPDATE
USING (submitted_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete daily_operations"
ON public.daily_operations FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_daily_operations_updated_at
BEFORE UPDATE ON public.daily_operations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();