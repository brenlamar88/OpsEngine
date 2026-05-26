-- Fix display order: Move "Professional Fees - Contract Management" before the Total rows
-- and shift the Total rows down

-- Update the new row to display_order 4
UPDATE public.budget_rows 
SET display_order = 4 
WHERE row_key = 'professional_fees_contract_management';

-- Update Total Billing Fixed Cost to display_order 5
UPDATE public.budget_rows 
SET display_order = 5 
WHERE row_key = 'total_billing_fixed_cost';

-- Update Total Billing Fixed PPD to display_order 6
UPDATE public.budget_rows 
SET display_order = 6 
WHERE row_key = 'total_billing_fixed_ppd';

-- Also update the formula for Total Billing Fixed Cost to include the new row
UPDATE public.budget_rows 
SET formula = 'SUM(billing_fixed_salaried_wages, billing_fixed_prof_fees_backend_biller, billing_fixed_prof_fees_software, professional_fees_contract_management)'
WHERE row_key = 'total_billing_fixed_cost';