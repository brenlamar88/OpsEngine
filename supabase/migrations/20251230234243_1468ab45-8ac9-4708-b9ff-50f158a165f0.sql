-- Insert IOP-specific budget sections
INSERT INTO budget_sections (name, display_order, is_active) VALUES
('IOP Total Number of Potential Scheduled Patients Per Week Day', 100, true),
('IOP Utilization', 101, true),
('IOP Utilization Percentages', 102, true),
('IOP Patient Days', 103, true),
('IOP Revenue by PPD', 104, true),
('IOP Gross Revenue', 105, true);

-- Insert IOP-specific budget rows with IOP-prefixed keys
-- IOP Total Number of Potential Scheduled Patients section
INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, display_order)
SELECT id, 'iop_potential_scheduled_patients', 'IOP Total Number of Potential Scheduled Patients Per Week Day', 'integer', 'both', 'manual', 1
FROM budget_sections WHERE name = 'IOP Total Number of Potential Scheduled Patients Per Week Day';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, display_order)
SELECT id, 'iop_days_in_month', 'Days in Month', 'integer', 'both', 'manual', 2
FROM budget_sections WHERE name = 'IOP Total Number of Potential Scheduled Patients Per Week Day';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, display_order)
SELECT id, 'iop_weekdays', 'Weekdays', 'integer', 'both', 'manual', 3
FROM budget_sections WHERE name = 'IOP Total Number of Potential Scheduled Patients Per Week Day';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, display_order)
SELECT id, 'iop_weekend_days', 'Weekend Days', 'integer', 'both', 'manual', 4
FROM budget_sections WHERE name = 'IOP Total Number of Potential Scheduled Patients Per Week Day';

-- IOP Utilization section
INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_total_visits', 'Total Visits', 'decimal', 'both', 'manual', NULL, 1
FROM budget_sections WHERE name = 'IOP Utilization';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_ada', 'Average Daily Attendance (ADA)', 'decimal', 'both', 'calculated', 'DIV(iop_total_visits, iop_weekdays)', 2
FROM budget_sections WHERE name = 'IOP Utilization';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_attendance_rate', 'Attendance Rate', 'percent', 'both', 'calculated', 'DIV(iop_ada, iop_potential_scheduled_patients)', 3
FROM budget_sections WHERE name = 'IOP Utilization';

-- IOP Utilization Percentages section
INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_trad_medicare_util_pct', 'Traditional Medicare', 'percent', 'both', 'manual', NULL, 1
FROM budget_sections WHERE name = 'IOP Utilization Percentages';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_other_util_pct', 'Other', 'percent', 'both', 'manual', NULL, 2
FROM budget_sections WHERE name = 'IOP Utilization Percentages';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_total_util_pct', 'Total Utilization', 'percent', 'both', 'calculated', 'SUM(iop_trad_medicare_util_pct, iop_other_util_pct)', 3
FROM budget_sections WHERE name = 'IOP Utilization Percentages';

-- IOP Patient Days section
INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_trad_medicare_pt_days', 'Traditional Medicare', 'integer', 'both', 'calculated', 'MULT(iop_total_visits, iop_trad_medicare_util_pct)', 1
FROM budget_sections WHERE name = 'IOP Patient Days';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_other_pt_days', 'Other', 'integer', 'both', 'calculated', 'MULT(iop_total_visits, iop_other_util_pct)', 2
FROM budget_sections WHERE name = 'IOP Patient Days';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_total_pt_days', 'Total Utilization', 'integer', 'both', 'calculated', 'SUM(iop_trad_medicare_pt_days, iop_other_pt_days)', 3
FROM budget_sections WHERE name = 'IOP Patient Days';

-- IOP Revenue by PPD section
INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_trad_medicare_rev_ppd', 'Traditional Medicare', 'currency', 'both', 'manual', NULL, 1
FROM budget_sections WHERE name = 'IOP Revenue by PPD';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_other_rev_ppd', 'Other', 'currency', 'both', 'manual', NULL, 2
FROM budget_sections WHERE name = 'IOP Revenue by PPD';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_total_rev_ppd', 'Total Utilization', 'currency', 'both', 'calculated', 'DIV(iop_total_net_revenue, iop_total_pt_days)', 3
FROM budget_sections WHERE name = 'IOP Revenue by PPD';

-- IOP Gross Revenue section
INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_trad_medicare_gross_rev', 'Traditional Medicare', 'currency', 'both', 'calculated', 'MULT(iop_trad_medicare_rev_ppd, iop_trad_medicare_pt_days)', 1
FROM budget_sections WHERE name = 'IOP Gross Revenue';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_other_gross_rev', 'Other', 'currency', 'both', 'calculated', 'MULT(iop_other_rev_ppd, iop_other_pt_days)', 2
FROM budget_sections WHERE name = 'IOP Gross Revenue';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_less_bad_debt', 'Less: Bad Debt', 'currency', 'both', 'manual', NULL, 3
FROM budget_sections WHERE name = 'IOP Gross Revenue';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_total_net_revenue', 'Total Net Revenue', 'currency', 'both', 'calculated', 'SUM(iop_trad_medicare_gross_rev, iop_other_gross_rev, iop_less_bad_debt)', 4
FROM budget_sections WHERE name = 'IOP Gross Revenue';

INSERT INTO budget_rows (section_id, row_key, name, data_type, entry_mode, calculation_type, formula, display_order)
SELECT id, 'iop_revenue_avg_ppd', 'Revenue Avg PPD', 'currency', 'both', 'calculated', 'DIV(iop_total_net_revenue, iop_total_pt_days)', 5
FROM budget_sections WHERE name = 'IOP Gross Revenue';