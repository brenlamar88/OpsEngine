-- Update Occupancy Rate formulas to multiply by 100 for proper percentage display
UPDATE budget_rows 
SET formula = 'MULT(DIV(adc, psych_total_number_of_beds), 100)'
WHERE row_key = 'occ_rate';

UPDATE budget_rows 
SET formula = 'MULT(DIV(other_adc, psych_total_number_of_beds), 100)'
WHERE row_key = 'other_occupancy_rate';

UPDATE budget_rows 
SET formula = 'MULT(DIV(total_adc, psych_total_number_of_beds), 100)'
WHERE row_key = 'total_occupancy_rate';