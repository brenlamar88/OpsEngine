-- Update total_net_program_revenue formula to ADD less_bad_debt (since it's entered as negative)
UPDATE budget_rows 
SET formula = 'SUM(total_contract_rate_program_rev, total_medicaid_program_rev, total_medicare_adv_program_rev, total_commercial_program_rev, total_private_pay_program_rev, total_charity_indigent_program_rev, less_bad_debt)',
    updated_at = now()
WHERE row_key = 'total_net_program_revenue';