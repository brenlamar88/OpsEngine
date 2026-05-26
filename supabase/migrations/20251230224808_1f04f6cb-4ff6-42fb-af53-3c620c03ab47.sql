-- Create unit_budget_config table to store budget configuration per unit
CREATE TABLE public.unit_budget_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  
  -- Budget Revenue Rates (per payer type)
  rate_mcr_full_days NUMERIC NOT NULL DEFAULT 955,
  rate_mcr_co_days NUMERIC NOT NULL DEFAULT 536,
  rate_mcr_lifetime_days NUMERIC NOT NULL DEFAULT 117,
  rate_hmo NUMERIC NOT NULL DEFAULT 900,
  rate_medicaid NUMERIC NOT NULL DEFAULT 737,
  rate_commercial NUMERIC NOT NULL DEFAULT 800,
  rate_private_pay NUMERIC NOT NULL DEFAULT 800,
  rate_charity_indigent NUMERIC NOT NULL DEFAULT 0,
  
  -- Budgeted Daily Costs (census 0-35 lookup stored as JSONB)
  budgeted_daily_costs JSONB NOT NULL DEFAULT '{
    "0": 9276.45, "1": 9212.32, "2": 9148.19, "3": 9084.06, "4": 9019.93,
    "5": 8955.80, "6": 8891.67, "7": 8827.54, "8": 8763.41, "9": 8699.28,
    "10": 8635.15, "11": 8571.02, "12": 8506.89, "13": 8442.76, "14": 8378.63,
    "15": 8314.50, "16": 8250.37, "17": 8186.24, "18": 8122.11, "19": 8057.98,
    "20": 7993.85, "21": 7929.72, "22": 7865.59, "23": 7801.46, "24": 7737.33,
    "25": 7673.20, "26": 7609.07, "27": 7544.94, "28": 7480.81, "29": 7416.68,
    "30": 7352.55, "31": 7288.42, "32": 7224.29, "33": 7160.16, "34": 7096.03,
    "35": 7031.90
  }'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(unit_id)
);

-- Enable RLS
ALTER TABLE public.unit_budget_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "All users can view unit_budget_config"
ON public.unit_budget_config
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert unit_budget_config"
ON public.unit_budget_config
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update unit_budget_config"
ON public.unit_budget_config
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete unit_budget_config"
ON public.unit_budget_config
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_unit_budget_config_updated_at
BEFORE UPDATE ON public.unit_budget_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();