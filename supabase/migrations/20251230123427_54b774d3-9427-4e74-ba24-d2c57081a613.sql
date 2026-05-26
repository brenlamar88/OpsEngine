-- Rename other_contract_rate_rev_ppd to other_commercial_rev_ppd
UPDATE public.budget_rows 
SET row_key = 'other_commercial_rev_ppd'
WHERE row_key = 'other_contract_rate_rev_ppd';

-- Also rename the duplicate version if it exists
UPDATE public.budget_rows 
SET row_key = 'other_commercial_rev_ppd_dup'
WHERE row_key = 'other_contract_rate_rev_ppd_dup';