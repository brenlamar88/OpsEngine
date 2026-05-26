-- Update total_operating_revenue to equal total_net_program_revenue
UPDATE budget_rows 
SET formula = 'total_net_program_revenue',
    updated_at = now()
WHERE row_key = 'total_operating_revenue';