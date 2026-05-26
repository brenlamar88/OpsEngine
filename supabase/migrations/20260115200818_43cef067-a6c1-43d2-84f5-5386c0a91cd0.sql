-- Update all PPD formulas to use total_patient_days instead of pt_days
-- This fixes the calculation so PPD = Section Total Cost / Total Inpatient Patient Days

-- Administration PPDs
UPDATE budget_rows SET formula = 'DIV(total_admin_fixed_cost, total_patient_days)' WHERE row_key = 'total_admin_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_admin_variable_cost, total_patient_days)' WHERE row_key = 'total_admin_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_administration_cost, total_patient_days)' WHERE row_key = 'total_administration_ppd';

-- Billing PPDs
UPDATE budget_rows SET formula = 'DIV(total_billing_fixed_cost, total_patient_days)' WHERE row_key = 'total_billing_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_billing_variable_cost, total_patient_days)' WHERE row_key = 'total_billing_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_billing_cost, total_patient_days)' WHERE row_key = 'total_billing_ppd';

-- Clinical Services PPDs
UPDATE budget_rows SET formula = 'DIV(total_clinical_fixed_cost, total_patient_days)' WHERE row_key = 'total_clinical_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_clinical_variable_cost, total_patient_days)' WHERE row_key = 'total_clinical_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_clinical_services_cost, total_patient_days)' WHERE row_key = 'total_clinical_services_ppd';

-- Service Development PPDs
UPDATE budget_rows SET formula = 'DIV(total_svcdev_fixed_cost, total_patient_days)' WHERE row_key = 'total_svcdev_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_svcdev_variable_cost, total_patient_days)' WHERE row_key = 'total_svcdev_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_service_development_cost, total_patient_days)' WHERE row_key = 'total_service_development_ppd';

-- Dietary PPDs
UPDATE budget_rows SET formula = 'DIV(total_dietary_fixed_cost, total_patient_days)' WHERE row_key = 'total_dietary_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_dietary_variable_cost, total_patient_days)' WHERE row_key = 'total_dietary_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_dietary_cost, total_patient_days)' WHERE row_key = 'total_dietary_ppd';

-- Housekeeping PPDs
UPDATE budget_rows SET formula = 'DIV(total_housekeeping_fixed_cost, total_patient_days)' WHERE row_key = 'total_housekeeping_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_housekeeping_variable_cost, total_patient_days)' WHERE row_key = 'total_housekeeping_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_housekeeping_cost, total_patient_days)' WHERE row_key = 'total_housekeeping_ppd';

-- HR PPDs
UPDATE budget_rows SET formula = 'DIV(total_hr_fixed_cost, total_patient_days)' WHERE row_key = 'total_hr_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_hr_variable_cost, total_patient_days)' WHERE row_key = 'total_hr_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_hr_cost, total_patient_days)' WHERE row_key = 'total_hr_ppd';

-- Laboratory PPDs
UPDATE budget_rows SET formula = 'DIV(total_laboratory_fixed_cost, total_patient_days)' WHERE row_key = 'total_laboratory_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_laboratory_variable_cost, total_patient_days)' WHERE row_key = 'total_laboratory_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_laboratory_cost, total_patient_days)' WHERE row_key = 'total_laboratory_ppd';

-- Medical Records PPDs
UPDATE budget_rows SET formula = 'DIV(total_med_rec_fixed_cost, total_patient_days)' WHERE row_key = 'total_med_rec_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_med_rec_variable_cost, total_patient_days)' WHERE row_key = 'total_med_rec_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_medical_records_cost, total_patient_days)' WHERE row_key = 'total_medical_records_ppd';

-- Nursing PPDs
UPDATE budget_rows SET formula = 'DIV(total_nursing_fixed_cost, total_patient_days)' WHERE row_key = 'total_nursing_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_nursing_variable_cost, total_patient_days)' WHERE row_key = 'total_nursing_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_nursing_cost, total_patient_days)' WHERE row_key = 'total_nursing_ppd';

-- Pharmacy PPDs
UPDATE budget_rows SET formula = 'DIV(total_pharmacy_fixed_cost, total_patient_days)' WHERE row_key = 'total_pharmacy_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_pharmacy_variable_cost, total_patient_days)' WHERE row_key = 'total_pharmacy_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_pharmacy_cost, total_patient_days)' WHERE row_key = 'total_pharmacy_ppd';

-- Environment of Care PPDs
UPDATE budget_rows SET formula = 'DIV(total_eoc_fixed_cost, total_patient_days)' WHERE row_key = 'total_eoc_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_eoc_variable_cost, total_patient_days)' WHERE row_key = 'total_eoc_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_environment_of_care_cost, total_patient_days)' WHERE row_key = 'total_environment_of_care_ppd';

-- Diagnostics PPDs
UPDATE budget_rows SET formula = 'DIV(total_diagnostics_fixed_cost, total_patient_days)' WHERE row_key = 'total_diagnostics_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_diagnostics_variable_cost, total_patient_days)' WHERE row_key = 'total_diagnostics_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_diagnostics_cost, total_patient_days)' WHERE row_key = 'total_diagnostics_ppd';

-- Rehab PPDs
UPDATE budget_rows SET formula = 'DIV(total_rehab_fixed_cost, total_patient_days)' WHERE row_key = 'total_rehab_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_rehab_variable_cost, total_patient_days)' WHERE row_key = 'total_rehab_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_rehab_cost, total_patient_days)' WHERE row_key = 'total_rehab_ppd';

-- Transport PPDs
UPDATE budget_rows SET formula = 'DIV(total_transport_fixed_cost, total_patient_days)' WHERE row_key = 'total_transport_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_transport_variable_cost, total_patient_days)' WHERE row_key = 'total_transport_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_transport_cost, total_patient_days)' WHERE row_key = 'total_transport_ppd';

-- QAPI PPDs
UPDATE budget_rows SET formula = 'DIV(total_qapi_fixed_cost, total_patient_days)' WHERE row_key = 'total_qapi_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_qapi_variable_cost, total_patient_days)' WHERE row_key = 'total_qapi_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_qapi_cost, total_patient_days)' WHERE row_key = 'total_qapi_ppd';

-- Other Expenses PPDs
UPDATE budget_rows SET formula = 'DIV(total_other_expenses_fixed_cost, total_patient_days)' WHERE row_key = 'total_other_expenses_fixed_ppd';
UPDATE budget_rows SET formula = 'DIV(total_other_expenses_variable_cost, total_patient_days)' WHERE row_key = 'total_other_expenses_variable_ppd';
UPDATE budget_rows SET formula = 'DIV(total_other_expenses_cost, total_patient_days)' WHERE row_key = 'total_other_expenses_ppd';

-- Operating PPDs
UPDATE budget_rows SET formula = 'DIV(total_operating_expense, total_patient_days)' WHERE row_key = 'total_operating_expense_ppd';
UPDATE budget_rows SET formula = 'DIV(total_operating_revenue, total_patient_days)' WHERE row_key = 'total_operating_revenue_ppd';

-- Net Revenue PPDs
UPDATE budget_rows SET formula = 'DIV(total_net_program_revenue, total_patient_days)' WHERE row_key = 'net_program_avg_rev_ppd';

-- EBITDA PPD
UPDATE budget_rows SET formula = 'DIV(ebitda, total_patient_days)' WHERE row_key = 'ebitda_ppd';

-- Net Income PPD
UPDATE budget_rows SET formula = 'DIV(net_income, total_patient_days)' WHERE row_key = 'net_income_ppd';