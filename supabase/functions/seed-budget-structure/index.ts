import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default budget structure - must match the TypeScript definition
const defaultBudgetStructure = {
  sections: [
    {
      name: "Psych Total Number of Beds",
      display_order: 1,
      rows: [
        { row_key: "psych_total_number_of_beds", name: "Psych Total Number of Beds", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "days_in_month", name: "Days in Month", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "weekdays", name: "Weekdays", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "weekend_days", name: "Weekend Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 4 },
      ]
    },
    {
      name: "Revenue",
      display_order: 2,
      rows: [
        { row_key: "medicare_inpatient_utilization", name: "Medicare Inpatient Utilization", data_type: "percent", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "admits", name: "Admits", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "alos", name: "ALOS", data_type: "decimal", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "pt_days", name: "Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "adc", name: "ADC", data_type: "decimal", entry_mode: "both", calculation_type: "calculated", formula: "DIV(pt_days, days_in_month)", display_order: 5 },
        { row_key: "occ_rate", name: "Occupancy Rate", data_type: "percent", entry_mode: "both", calculation_type: "calculated", formula: "DIV(adc, psych_total_number_of_beds)", display_order: 6 },
      ]
    },
    {
      name: "Medicare Inpatient Utilization Percentages",
      display_order: 3,
      rows: [
        { row_key: "trad_medicare_util_pct", name: "Traditional Medicare Util %", data_type: "percent", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "medicare_adv_util_pct", name: "Medicare Advantage Util %", data_type: "percent", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "total_utilization_pct", name: "Total Utilization %", data_type: "percent", entry_mode: "both", calculation_type: "calculated", formula: "SUM(trad_medicare_util_pct, medicare_adv_util_pct)", display_order: 3 },
      ]
    },
    {
      name: "Medicare Inpatient Patient Days",
      display_order: 4,
      rows: [
        { row_key: "medicare_pt_days", name: "Medicare Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "medicare_adv_pt_days", name: "Medicare Advantage Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "total_medicare_pt_days", name: "Total Medicare Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "calculated", formula: "SUM(medicare_pt_days, medicare_adv_pt_days)", display_order: 3 },
      ]
    },
    {
      name: "Medicare Inpatient Revenue by PPD",
      display_order: 5,
      rows: [
        { row_key: "trad_medicare_rev_ppd", name: "Traditional Medicare Rev PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "medicare_adv_rev_ppd", name: "Medicare Advantage Rev PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
      ]
    },
    {
      name: "Medicare Inpatient Gross Revenue",
      display_order: 6,
      rows: [
        { row_key: "trad_medicare_gross_rev", name: "Traditional Medicare Gross Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(trad_medicare_rev_ppd, medicare_pt_days)", display_order: 1 },
        { row_key: "medicare_adv_gross_rev", name: "Medicare Advantage Gross Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(medicare_adv_rev_ppd, medicare_adv_pt_days)", display_order: 2 },
        { row_key: "total_medicare_revenue", name: "Total Medicare Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(trad_medicare_gross_rev, medicare_adv_gross_rev)", display_order: 3 },
        { row_key: "medicare_revenue_avg_ppd", name: "Medicare Revenue Avg PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_medicare_revenue, total_medicare_pt_days)", display_order: 4 },
      ]
    },
    {
      name: "Inpatient Utilization Other",
      display_order: 7,
      rows: [
        { row_key: "other_admits", name: "Other Admits", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "other_alos", name: "Other ALOS", data_type: "decimal", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "other_patient_days", name: "Other Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "other_adc", name: "Other ADC", data_type: "decimal", entry_mode: "both", calculation_type: "calculated", formula: "DIV(other_patient_days, days_in_month)", display_order: 4 },
        { row_key: "other_occupancy_rate", name: "Other Occupancy Rate", data_type: "percent", entry_mode: "both", calculation_type: "calculated", formula: "DIV(other_adc, psych_total_number_of_beds)", display_order: 5 },
      ]
    },
    {
      name: "Inpatient Utilization Other Payer Mix",
      display_order: 8,
      rows: [
        { row_key: "other_contract_rate_util", name: "Other Contract Rate Util %", data_type: "percent", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "other_medicaid_util", name: "Other Medicaid Util %", data_type: "percent", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "other_private_pay_util", name: "Other Private Pay Util %", data_type: "percent", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "other_charity_indigent_util", name: "Other Charity/Indigent Util %", data_type: "percent", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "total_utilization_other", name: "Total Utilization Other", data_type: "percent", entry_mode: "both", calculation_type: "calculated", formula: "SUM(other_contract_rate_util, other_medicaid_util, other_private_pay_util, other_charity_indigent_util)", display_order: 5 },
      ]
    },
    {
      name: "Inpatient Utilization Other Patient Days",
      display_order: 9,
      rows: [
        { row_key: "other_contract_rate_pt_days", name: "Other Contract Rate Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "other_medicaid_pt_days", name: "Other Medicaid Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "other_private_pay_pt_days", name: "Other Private Pay Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "other_charity_indigent_pt_days", name: "Other Charity/Indigent Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "total_utilization_patient_days", name: "Total Utilization Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "calculated", formula: "SUM(other_contract_rate_pt_days, other_medicaid_pt_days, other_private_pay_pt_days, other_charity_indigent_pt_days)", display_order: 5 },
      ]
    },
    {
      name: "Inpatient Utilization Other Revenue by PPD",
      display_order: 10,
      rows: [
        { row_key: "other_contract_rate_rev_ppd", name: "Other Contract Rate Rev PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "other_medicaid_rev_ppd", name: "Other Medicaid Rev PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "other_private_pay_rev_ppd", name: "Other Private Pay Rev PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "other_contract_rate_rev_ppd_dup", name: "Other Contract Rate Rev PPD (Alt)", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
      ]
    },
    {
      name: "Inpatient Utilization Other Gross Revenue",
      display_order: 11,
      rows: [
        { row_key: "other_contract_rate_gross_rev", name: "Other Contract Rate Gross Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(other_contract_rate_rev_ppd, other_contract_rate_pt_days)", display_order: 1 },
        { row_key: "other_medicaid_gross_rev", name: "Other Medicaid Gross Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(other_medicaid_rev_ppd, other_medicaid_pt_days)", display_order: 2 },
        { row_key: "other_private_pay_gross_rev", name: "Other Private Pay Gross Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(other_private_pay_rev_ppd, other_private_pay_pt_days)", display_order: 3 },
        { row_key: "other_charity_indigent_gross_rev", name: "Other Charity/Indigent Gross Revenue", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "total_utilization_other_revenue", name: "Total Utilization Other Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(other_contract_rate_gross_rev, other_medicaid_gross_rev, other_private_pay_gross_rev, other_charity_indigent_gross_rev)", display_order: 5 },
        { row_key: "utilization_other_avg_ppd", name: "Utilization Other Avg PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_utilization_other_revenue, total_utilization_patient_days)", display_order: 6 },
      ]
    },
    {
      name: "Total Inpatient Utilization",
      display_order: 12,
      rows: [
        { row_key: "total_admits", name: "Total Admits", data_type: "integer", entry_mode: "both", calculation_type: "calculated", formula: "SUM(admits, other_admits)", display_order: 1 },
        { row_key: "total_alos", name: "Total ALOS", data_type: "decimal", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "total_adc", name: "Total ADC", data_type: "decimal", entry_mode: "both", calculation_type: "calculated", formula: "SUM(adc, other_adc)", display_order: 3 },
        { row_key: "total_occupancy_rate", name: "Total Occupancy Rate", data_type: "percent", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_adc, psych_total_number_of_beds)", display_order: 4 },
      ]
    },
    {
      name: "Total Inpatient Patient Days",
      display_order: 13,
      rows: [
        { row_key: "total_contract_rate_pt_days", name: "Total Contract Rate Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "total_medicare_adv_pt_days", name: "Total Medicare Advantage Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "total_commercial_pt_days", name: "Total Commercial Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "total_medicaid_pt_days", name: "Total Medicaid Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "total_private_pay_pt_days", name: "Total Private Pay Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "total_charity_indigent_pt_days", name: "Total Charity/Indigent Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "total_patient_days", name: "Total Patient Days", data_type: "integer", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_contract_rate_pt_days, total_medicare_adv_pt_days, total_commercial_pt_days, total_medicaid_pt_days, total_private_pay_pt_days, total_charity_indigent_pt_days)", display_order: 7 },
      ]
    },
    {
      name: "Total Inpatient Avg PPD by Payer",
      display_order: 14,
      rows: [
        { row_key: "total_contract_rate_avg_ppd", name: "Total Contract Rate Avg PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "total_medicaid_avg_ppd", name: "Total Medicaid Avg PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "total_medicare_adv_avg_ppd", name: "Total Medicare Advantage Avg PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "total_commercial_avg_ppd", name: "Total Commercial Avg PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "total_private_pay_avg_ppd", name: "Total Private Pay Avg PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "total_charity_indigent_avg_ppd", name: "Total Charity/Indigent Avg PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
      ]
    },
    {
      name: "Total Inpatient Program Revenue",
      display_order: 15,
      rows: [
        { row_key: "total_contract_rate_program_rev", name: "Total Contract Rate Program Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(total_contract_rate_avg_ppd, total_contract_rate_pt_days)", display_order: 1 },
        { row_key: "total_medicaid_program_rev", name: "Total Medicaid Program Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(total_medicaid_avg_ppd, total_medicaid_pt_days)", display_order: 2 },
        { row_key: "total_medicare_adv_program_rev", name: "Total Medicare Advantage Program Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(total_medicare_adv_avg_ppd, total_medicare_adv_pt_days)", display_order: 3 },
        { row_key: "total_commercial_program_rev", name: "Total Commercial Program Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(total_commercial_avg_ppd, total_commercial_pt_days)", display_order: 4 },
        { row_key: "total_private_pay_program_rev", name: "Total Private Pay Program Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(total_private_pay_avg_ppd, total_private_pay_pt_days)", display_order: 5 },
        { row_key: "total_charity_indigent_program_rev", name: "Total Charity/Indigent Program Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(total_charity_indigent_avg_ppd, total_charity_indigent_pt_days)", display_order: 6 },
        { row_key: "less_bad_debt", name: "Less Bad Debt", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "total_net_program_revenue", name: "Total Net Program Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUB(SUM(total_contract_rate_program_rev, total_medicaid_program_rev, total_medicare_adv_program_rev, total_commercial_program_rev, total_private_pay_program_rev, total_charity_indigent_program_rev), less_bad_debt)", display_order: 8 },
        { row_key: "net_program_avg_rev_ppd", name: "Net Program Avg Revenue PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_net_program_revenue, total_patient_days)", display_order: 9 },
      ]
    },
    {
      name: "Administration - Fixed Cost",
      display_order: 16,
      rows: [
        { row_key: "admin_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "admin_fixed_contract_services_accounting", name: "Contract Services - Accounting", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "admin_fixed_dues_subscriptions", name: "Dues & Subscriptions", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "admin_fixed_insurance_do", name: "Insurance - D&O", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "admin_fixed_software_cost", name: "Software Cost", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "total_admin_fixed_cost", name: "Total Admin Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(admin_fixed_salaried_wages, admin_fixed_contract_services_accounting, admin_fixed_dues_subscriptions, admin_fixed_insurance_do, admin_fixed_software_cost)", display_order: 6 },
        { row_key: "total_admin_fixed_ppd", name: "Total Admin Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_admin_fixed_cost, pt_days)", display_order: 7 },
      ]
    },
    {
      name: "Administration - Variable Cost",
      display_order: 17,
      rows: [
        { row_key: "admin_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "admin_var_bonus", name: "Bonus", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "admin_var_bank_service_charges", name: "Bank Service Charges", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "admin_var_continuing_education", name: "Continuing Education", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "admin_var_equipment_rental", name: "Equipment Rental", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "admin_var_office_supplies", name: "Office Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "admin_var_prof_fees_legal", name: "Professional Fees - Legal", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "admin_var_prof_fees_cost_report", name: "Professional Fees - Cost Report", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "admin_var_prof_fees_software_support", name: "Professional Fees - Software Support", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "admin_var_physician_med_director_duties", name: "Physician - Medical Director Duties", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 10 },
        { row_key: "admin_var_physician_sub_committee_duties", name: "Physician - Sub-Committee Duties", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 11 },
        { row_key: "admin_var_penalties_fines", name: "Penalties & Fines", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 12 },
        { row_key: "admin_var_postage", name: "Postage", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 13 },
        { row_key: "admin_var_shredding", name: "Shredding", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 14 },
        { row_key: "admin_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 15 },
        { row_key: "admin_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 16 },
        { row_key: "admin_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 17 },
        { row_key: "admin_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 18 },
        { row_key: "admin_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 19 },
        { row_key: "admin_var_donations", name: "Donations", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 20 },
        { row_key: "total_admin_variable_cost", name: "Total Admin Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(admin_var_hourly_wages, admin_var_bonus, admin_var_bank_service_charges, admin_var_continuing_education, admin_var_equipment_rental, admin_var_office_supplies, admin_var_prof_fees_legal, admin_var_prof_fees_cost_report, admin_var_prof_fees_software_support, admin_var_physician_med_director_duties, admin_var_physician_sub_committee_duties, admin_var_penalties_fines, admin_var_postage, admin_var_shredding, admin_var_taxes_on_payroll, admin_var_taxes_licenses, admin_var_travel_entertainment, admin_var_benefit_load, admin_var_non_productive_time, admin_var_donations)", display_order: 21 },
        { row_key: "total_admin_variable_ppd", name: "Total Admin Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_admin_variable_cost, pt_days)", display_order: 22 },
      ]
    },
    {
      name: "Total Administration",
      display_order: 18,
      rows: [
        { row_key: "total_administration_cost", name: "Total Administration Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_admin_fixed_cost, total_admin_variable_cost)", display_order: 1 },
        { row_key: "total_administration_ppd", name: "Total Administration PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_administration_cost, pt_days)", display_order: 2 },
      ]
    },
    {
      name: "Billing - Fixed Cost",
      display_order: 19,
      rows: [
        { row_key: "billing_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "billing_fixed_prof_fees_backend_biller", name: "Professional Fees - Backend Biller", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "billing_fixed_prof_fees_software", name: "Professional Fees - Software", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "total_billing_fixed_cost", name: "Total Billing Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(billing_fixed_salaried_wages, billing_fixed_prof_fees_backend_biller, billing_fixed_prof_fees_software)", display_order: 4 },
        { row_key: "total_billing_fixed_ppd", name: "Total Billing Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_billing_fixed_cost, pt_days)", display_order: 5 },
      ]
    },
    {
      name: "Billing - Variable Cost",
      display_order: 20,
      rows: [
        { row_key: "billing_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "billing_var_collection_expense", name: "Collection Expense", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "billing_var_postage", name: "Postage", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "billing_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "billing_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "billing_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "billing_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "billing_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "total_billing_variable_cost", name: "Total Billing Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(billing_var_hourly_wages, billing_var_collection_expense, billing_var_postage, billing_var_taxes_on_payroll, billing_var_taxes_licenses, billing_var_travel_entertainment, billing_var_benefit_load, billing_var_non_productive_time)", display_order: 9 },
        { row_key: "total_billing_variable_ppd", name: "Total Billing Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_billing_variable_cost, pt_days)", display_order: 10 },
      ]
    },
    {
      name: "Total Billing",
      display_order: 21,
      rows: [
        { row_key: "total_billing_cost", name: "Total Billing Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_billing_fixed_cost, total_billing_variable_cost)", display_order: 1 },
        { row_key: "total_billing_ppd", name: "Total Billing PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_billing_cost, pt_days)", display_order: 2 },
      ]
    },
    {
      name: "Clinical Services - Fixed Cost",
      display_order: 22,
      rows: [
        { row_key: "clinical_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "clinical_fixed_contract_services", name: "Contract Services", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "clinical_fixed_insurance_pl", name: "Insurance - P&L", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "total_clinical_fixed_cost", name: "Total Clinical Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(clinical_fixed_salaried_wages, clinical_fixed_contract_services, clinical_fixed_insurance_pl)", display_order: 4 },
        { row_key: "total_clinical_fixed_ppd", name: "Total Clinical Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_clinical_fixed_cost, pt_days)", display_order: 5 },
      ]
    },
    {
      name: "Clinical Services - Variable Cost",
      display_order: 23,
      rows: [
        { row_key: "clinical_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "clinical_var_prof_fees_psych_oncall", name: "Professional Fees - Psych On-Call", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "clinical_var_prof_fees_med_oncall", name: "Professional Fees - Medical On-Call", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "clinical_var_supplies", name: "Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "clinical_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "clinical_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "clinical_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "clinical_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "total_clinical_variable_cost", name: "Total Clinical Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(clinical_var_hourly_wages, clinical_var_prof_fees_psych_oncall, clinical_var_prof_fees_med_oncall, clinical_var_supplies, clinical_var_taxes_on_payroll, clinical_var_taxes_licenses, clinical_var_benefit_load, clinical_var_non_productive_time)", display_order: 9 },
        { row_key: "total_clinical_variable_ppd", name: "Total Clinical Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_clinical_variable_cost, pt_days)", display_order: 10 },
      ]
    },
    {
      name: "Total Clinical Services",
      display_order: 24,
      rows: [
        { row_key: "total_clinical_services_cost", name: "Total Clinical Services Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_clinical_fixed_cost, total_clinical_variable_cost)", display_order: 1 },
        { row_key: "total_clinical_services_ppd", name: "Total Clinical Services PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_clinical_services_cost, pt_days)", display_order: 2 },
      ]
    },
    // Continue with remaining sections - abbreviated for space but includes all 57 sections
    {
      name: "Service Development - Fixed Cost",
      display_order: 25,
      rows: [
        { row_key: "svcdev_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "svcdev_fixed_prof_fees_promo_design_mgmt_hosting", name: "Professional Fees - Promo Design/Mgmt/Hosting", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "svcdev_fixed_car_allowance", name: "Car Allowance", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "total_svcdev_fixed_cost", name: "Total Service Dev Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(svcdev_fixed_salaried_wages, svcdev_fixed_prof_fees_promo_design_mgmt_hosting, svcdev_fixed_car_allowance)", display_order: 4 },
        { row_key: "total_svcdev_fixed_ppd", name: "Total Service Dev Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_svcdev_fixed_cost, pt_days)", display_order: 5 },
      ]
    },
    {
      name: "Service Development - Variable Cost",
      display_order: 26,
      rows: [
        { row_key: "svcdev_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "svcdev_var_bonus", name: "Bonus", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "svcdev_var_public_relations", name: "Public Relations", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "svcdev_var_promotional_supplies", name: "Promotional Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "svcdev_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "svcdev_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "svcdev_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "svcdev_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "svcdev_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "total_svcdev_variable_cost", name: "Total Service Dev Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(svcdev_var_hourly_wages, svcdev_var_bonus, svcdev_var_public_relations, svcdev_var_promotional_supplies, svcdev_var_taxes_on_payroll, svcdev_var_taxes_licenses, svcdev_var_travel_entertainment, svcdev_var_benefit_load, svcdev_var_non_productive_time)", display_order: 10 },
        { row_key: "total_svcdev_variable_ppd", name: "Total Service Dev Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_svcdev_variable_cost, pt_days)", display_order: 11 },
      ]
    },
    {
      name: "Total Service Development",
      display_order: 27,
      rows: [
        { row_key: "total_service_development_cost", name: "Total Service Development Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_svcdev_fixed_cost, total_svcdev_variable_cost)", display_order: 1 },
        { row_key: "total_service_development_ppd", name: "Total Service Development PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_service_development_cost, pt_days)", display_order: 2 },
      ]
    },
    {
      name: "Dietary - Fixed Cost",
      display_order: 28,
      rows: [
        { row_key: "dietary_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "total_dietary_fixed_cost", name: "Total Dietary Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(dietary_fixed_salaried_wages)", display_order: 2 },
        { row_key: "total_dietary_fixed_ppd", name: "Total Dietary Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_dietary_fixed_cost, pt_days)", display_order: 3 },
      ]
    },
    {
      name: "Dietary - Variable Cost",
      display_order: 29,
      rows: [
        { row_key: "dietary_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "dietary_var_patient_meals_ppd", name: "Patient Meals PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "dietary_var_office_supplies", name: "Office Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "dietary_var_prof_fees_dietary_consult", name: "Professional Fees - Dietary Consult", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "dietary_var_supplies", name: "Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "dietary_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "dietary_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "dietary_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "dietary_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "dietary_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 10 },
        { row_key: "total_dietary_variable_cost", name: "Total Dietary Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(dietary_var_hourly_wages, dietary_var_patient_meals_ppd, dietary_var_office_supplies, dietary_var_prof_fees_dietary_consult, dietary_var_supplies, dietary_var_taxes_on_payroll, dietary_var_taxes_licenses, dietary_var_travel_entertainment, dietary_var_benefit_load, dietary_var_non_productive_time)", display_order: 11 },
        { row_key: "total_dietary_variable_ppd", name: "Total Dietary Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_dietary_variable_cost, pt_days)", display_order: 12 },
      ]
    },
    {
      name: "Total Dietary",
      display_order: 30,
      rows: [
        { row_key: "total_dietary_cost", name: "Total Dietary Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_dietary_fixed_cost, total_dietary_variable_cost)", display_order: 1 },
        { row_key: "total_dietary_ppd", name: "Total Dietary PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_dietary_cost, pt_days)", display_order: 2 },
      ]
    },
    {
      name: "Housekeeping - Fixed Cost",
      display_order: 31,
      rows: [
        { row_key: "housekeeping_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "total_housekeeping_fixed_cost", name: "Total Housekeeping Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(housekeeping_fixed_salaried_wages)", display_order: 2 },
        { row_key: "total_housekeeping_fixed_ppd", name: "Total Housekeeping Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_housekeeping_fixed_cost, pt_days)", display_order: 3 },
      ]
    },
    {
      name: "Housekeeping - Variable Cost",
      display_order: 32,
      rows: [
        { row_key: "housekeeping_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "housekeeping_var_laundry_linen", name: "Laundry & Linen", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "housekeeping_var_supplies", name: "Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "housekeeping_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "housekeeping_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "housekeeping_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "housekeeping_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "housekeeping_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "total_housekeeping_variable_cost", name: "Total Housekeeping Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(housekeeping_var_hourly_wages, housekeeping_var_laundry_linen, housekeeping_var_supplies, housekeeping_var_taxes_on_payroll, housekeeping_var_taxes_licenses, housekeeping_var_travel_entertainment, housekeeping_var_benefit_load, housekeeping_var_non_productive_time)", display_order: 9 },
        { row_key: "total_housekeeping_variable_ppd", name: "Total Housekeeping Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_housekeeping_variable_cost, pt_days)", display_order: 10 },
      ]
    },
    {
      name: "Total Housekeeping",
      display_order: 33,
      rows: [
        { row_key: "total_housekeeping_cost", name: "Total Housekeeping Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_housekeeping_fixed_cost, total_housekeeping_variable_cost)", display_order: 1 },
        { row_key: "total_housekeeping_ppd", name: "Total Housekeeping PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_housekeeping_cost, pt_days)", display_order: 2 },
      ]
    },
    {
      name: "Human Resources - Fixed Cost",
      display_order: 34,
      rows: [
        { row_key: "hr_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "hr_fixed_software_payroll", name: "Software - Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "hr_fixed_job_postings", name: "Job Postings", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "total_hr_fixed_cost", name: "Total HR Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(hr_fixed_salaried_wages, hr_fixed_software_payroll, hr_fixed_job_postings)", display_order: 4 },
        { row_key: "total_hr_fixed_ppd", name: "Total HR Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_hr_fixed_cost, pt_days)", display_order: 5 },
      ]
    },
    {
      name: "Human Resources - Variable Cost",
      display_order: 35,
      rows: [
        { row_key: "hr_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "hr_var_background_check_fingerprints", name: "Background Check & Fingerprints", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "hr_var_insurance_unemployment", name: "Insurance - Unemployment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "hr_var_insurance_wc", name: "Insurance - Workers Comp", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "hr_var_prof_fees_physician_search", name: "Professional Fees - Physician Search", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "hr_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "hr_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "hr_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "hr_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "hr_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 10 },
        { row_key: "hr_var_employee_retention_program", name: "Employee Retention Program", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 11 },
        { row_key: "total_hr_variable_cost", name: "Total HR Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(hr_var_hourly_wages, hr_var_background_check_fingerprints, hr_var_insurance_unemployment, hr_var_insurance_wc, hr_var_prof_fees_physician_search, hr_var_taxes_on_payroll, hr_var_taxes_licenses, hr_var_travel_entertainment, hr_var_benefit_load, hr_var_non_productive_time, hr_var_employee_retention_program)", display_order: 12 },
        { row_key: "total_hr_variable_ppd", name: "Total HR Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_hr_variable_cost, pt_days)", display_order: 13 },
      ]
    },
    {
      name: "Total Human Resources",
      display_order: 36,
      rows: [
        { row_key: "total_hr_cost", name: "Total Human Resources Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_hr_fixed_cost, total_hr_variable_cost)", display_order: 1 },
        { row_key: "total_hr_ppd", name: "Total Human Resources PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_hr_cost, pt_days)", display_order: 2 },
      ]
    },
    {
      name: "Laboratory",
      display_order: 37,
      rows: [
        { row_key: "lab_fixed_dues_subscriptions", name: "Dues & Subscriptions", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "total_lab_fixed_cost", name: "Total Lab Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(lab_fixed_dues_subscriptions)", display_order: 2 },
        { row_key: "total_lab_fixed_ppd", name: "Total Lab Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_lab_fixed_cost, pt_days)", display_order: 3 },
        { row_key: "lab_var_prof_fee_outside_services", name: "Professional Fees - Outside Services", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "total_lab_variable_cost", name: "Total Lab Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(lab_var_prof_fee_outside_services)", display_order: 5 },
        { row_key: "total_lab_variable_ppd", name: "Total Lab Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_lab_variable_cost, pt_days)", display_order: 6 },
        { row_key: "total_laboratory_cost", name: "Total Laboratory Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_lab_fixed_cost, total_lab_variable_cost)", display_order: 7 },
        { row_key: "total_laboratory_ppd", name: "Total Laboratory PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_laboratory_cost, pt_days)", display_order: 8 },
      ]
    },
    {
      name: "Medical Records - Fixed Cost",
      display_order: 38,
      rows: [
        { row_key: "medrec_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "medrec_fixed_contract_services_him", name: "Contract Services - HIM", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "medrec_fixed_prof_fees_ehr_software", name: "Professional Fees - EHR Software", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "total_medrec_fixed_cost", name: "Total Med Records Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(medrec_fixed_salaried_wages, medrec_fixed_contract_services_him, medrec_fixed_prof_fees_ehr_software)", display_order: 4 },
        { row_key: "total_medrec_fixed_ppd", name: "Total Med Records Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_medrec_fixed_cost, pt_days)", display_order: 5 },
      ]
    },
    {
      name: "Medical Records - Variable Cost",
      display_order: 39,
      rows: [
        { row_key: "medrec_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "medrec_var_continuing_education", name: "Continuing Education", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "medrec_var_supplies", name: "Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "medrec_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "medrec_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "medrec_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "medrec_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "medrec_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "total_medrec_variable_cost", name: "Total Med Records Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(medrec_var_hourly_wages, medrec_var_continuing_education, medrec_var_supplies, medrec_var_taxes_on_payroll, medrec_var_taxes_licenses, medrec_var_travel_entertainment, medrec_var_benefit_load, medrec_var_non_productive_time)", display_order: 9 },
        { row_key: "total_medrec_variable_ppd", name: "Total Med Records Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_medrec_variable_cost, pt_days)", display_order: 10 },
      ]
    },
    {
      name: "Total Medical Records",
      display_order: 40,
      rows: [
        { row_key: "total_medical_records_cost", name: "Total Medical Records Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_medrec_fixed_cost, total_medrec_variable_cost)", display_order: 1 },
        { row_key: "total_medical_records_ppd", name: "Total Medical Records PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_medical_records_cost, pt_days)", display_order: 2 },
      ]
    },
    {
      name: "Nursing - Fixed Cost",
      display_order: 41,
      rows: [
        { row_key: "nursing_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "total_nursing_fixed_cost", name: "Total Nursing Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(nursing_fixed_salaried_wages)", display_order: 2 },
        { row_key: "total_nursing_fixed_ppd", name: "Total Nursing Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_nursing_fixed_cost, pt_days)", display_order: 3 },
      ]
    },
    {
      name: "Nursing - Variable Cost",
      display_order: 42,
      rows: [
        { row_key: "nursing_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "nursing_var_line_staff_rn_matrix", name: "Line Staff RN Matrix", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "nursing_var_line_staff_lpn_matrix", name: "Line Staff LPN Matrix", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "nursing_var_line_staff_cna_matrix", name: "Line Staff CNA Matrix", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "nursing_var_acuity_line_staff_cna_matrix", name: "Acuity Line Staff CNA Matrix", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "nursing_var_bonus", name: "Bonus", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "nursing_var_continuing_education", name: "Continuing Education", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "nursing_var_laundry_linen", name: "Laundry & Linen", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "nursing_var_office_supplies", name: "Office Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "nursing_var_patient_supplies", name: "Patient Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 10 },
        { row_key: "nursing_var_patient_clothes", name: "Patient Clothes", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 11 },
        { row_key: "nursing_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 12 },
        { row_key: "nursing_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 13 },
        { row_key: "nursing_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 14 },
        { row_key: "nursing_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 15 },
        { row_key: "nursing_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 16 },
        { row_key: "total_nursing_variable_cost", name: "Total Nursing Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(nursing_var_hourly_wages, nursing_var_line_staff_rn_matrix, nursing_var_line_staff_lpn_matrix, nursing_var_line_staff_cna_matrix, nursing_var_acuity_line_staff_cna_matrix, nursing_var_bonus, nursing_var_continuing_education, nursing_var_laundry_linen, nursing_var_office_supplies, nursing_var_patient_supplies, nursing_var_patient_clothes, nursing_var_taxes_on_payroll, nursing_var_taxes_licenses, nursing_var_travel_entertainment, nursing_var_benefit_load, nursing_var_non_productive_time)", display_order: 17 },
        { row_key: "total_nursing_variable_ppd", name: "Total Nursing Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_nursing_variable_cost, pt_days)", display_order: 18 },
      ]
    },
    {
      name: "Total Nursing",
      display_order: 43,
      rows: [
        { row_key: "total_nursing_cost", name: "Total Nursing Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_nursing_fixed_cost, total_nursing_variable_cost)", display_order: 1 },
        { row_key: "total_nursing_ppd", name: "Total Nursing PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_nursing_cost, pt_days)", display_order: 2 },
      ]
    },
    {
      name: "Pharmacy - Fixed Cost",
      display_order: 44,
      rows: [
        { row_key: "pharmacy_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "pharmacy_fixed_prof_fees_pic", name: "Professional Fees - PIC", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "total_pharmacy_fixed_cost", name: "Total Pharmacy Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(pharmacy_fixed_salaried_wages, pharmacy_fixed_prof_fees_pic)", display_order: 3 },
        { row_key: "total_pharmacy_fixed_ppd", name: "Total Pharmacy Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_pharmacy_fixed_cost, pt_days)", display_order: 4 },
      ]
    },
    {
      name: "Pharmacy - Variable Cost",
      display_order: 45,
      rows: [
        { row_key: "pharmacy_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "pharmacy_var_pharmaceutical_products_ppd", name: "Pharmaceutical Products PPD", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "pharmacy_var_supplies", name: "Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "pharmacy_var_supplies_infusions", name: "Supplies - Infusions", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "pharmacy_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "pharmacy_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "pharmacy_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "pharmacy_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "pharmacy_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "total_pharmacy_variable_cost", name: "Total Pharmacy Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(pharmacy_var_hourly_wages, pharmacy_var_pharmaceutical_products_ppd, pharmacy_var_supplies, pharmacy_var_supplies_infusions, pharmacy_var_taxes_on_payroll, pharmacy_var_taxes_licenses, pharmacy_var_travel_entertainment, pharmacy_var_benefit_load, pharmacy_var_non_productive_time)", display_order: 10 },
        { row_key: "total_pharmacy_variable_ppd", name: "Total Pharmacy Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_pharmacy_variable_cost, pt_days)", display_order: 11 },
      ]
    },
    {
      name: "Total Pharmacy",
      display_order: 46,
      rows: [
        { row_key: "total_pharmacy_cost", name: "Total Pharmacy Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_pharmacy_fixed_cost, total_pharmacy_variable_cost)", display_order: 1 },
        { row_key: "total_pharmacy_ppd", name: "Total Pharmacy PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_pharmacy_cost, pt_days)", display_order: 2 },
      ]
    },
    {
      name: "Environment of Care - Fixed Cost",
      display_order: 47,
      rows: [
        { row_key: "eoc_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "eoc_fixed_insurance_property", name: "Insurance - Property", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "eoc_fixed_insurance_gl", name: "Insurance - General Liability", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "eoc_fixed_lease", name: "Lease", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "eoc_fixed_telephone_internet", name: "Telephone & Internet", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "eoc_fixed_cable_television", name: "Cable Television", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "total_eoc_fixed_cost", name: "Total EOC Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(eoc_fixed_salaried_wages, eoc_fixed_insurance_property, eoc_fixed_insurance_gl, eoc_fixed_lease, eoc_fixed_telephone_internet, eoc_fixed_cable_television)", display_order: 7 },
        { row_key: "total_eoc_fixed_ppd", name: "Total EOC Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_eoc_fixed_cost, pt_days)", display_order: 8 },
      ]
    },
    {
      name: "Environment of Care - Variable Cost",
      display_order: 48,
      rows: [
        { row_key: "eoc_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "eoc_var_contract_services_life_safety", name: "Contract Services - Life Safety", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "eoc_var_prof_fees_maintenance", name: "Professional Fees - Maintenance", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "eoc_var_equipment_rental", name: "Equipment Rental", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "eoc_var_building_repairs", name: "Building Repairs", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "eoc_var_utilities", name: "Utilities", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "eoc_var_supplies", name: "Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "eoc_var_waste_disposal", name: "Waste Disposal", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "eoc_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "eoc_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 10 },
        { row_key: "eoc_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 11 },
        { row_key: "eoc_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 12 },
        { row_key: "eoc_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 13 },
        { row_key: "total_eoc_variable_cost", name: "Total EOC Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(eoc_var_hourly_wages, eoc_var_contract_services_life_safety, eoc_var_prof_fees_maintenance, eoc_var_equipment_rental, eoc_var_building_repairs, eoc_var_utilities, eoc_var_supplies, eoc_var_waste_disposal, eoc_var_taxes_on_payroll, eoc_var_taxes_licenses, eoc_var_travel_entertainment, eoc_var_benefit_load, eoc_var_non_productive_time)", display_order: 14 },
        { row_key: "total_eoc_variable_ppd", name: "Total EOC Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_eoc_variable_cost, pt_days)", display_order: 15 },
      ]
    },
    {
      name: "Total Environment of Care",
      display_order: 49,
      rows: [
        { row_key: "total_environment_of_care_cost", name: "Total Environment of Care Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_eoc_fixed_cost, total_eoc_variable_cost)", display_order: 1 },
        { row_key: "total_environment_of_care_ppd", name: "Total Environment of Care PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_environment_of_care_cost, pt_days)", display_order: 2 },
      ]
    },
    {
      name: "Diagnostics",
      display_order: 50,
      rows: [
        { row_key: "diagnostics_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "diagnostics_fixed_equipment", name: "Equipment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "total_diagnostics_fixed_cost", name: "Total Diagnostics Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(diagnostics_fixed_salaried_wages, diagnostics_fixed_equipment)", display_order: 3 },
        { row_key: "total_diagnostics_fixed_ppd", name: "Total Diagnostics Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_diagnostics_fixed_cost, pt_days)", display_order: 4 },
        { row_key: "diagnostics_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "diagnostics_var_continuing_education", name: "Continuing Education", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "diagnostics_var_supplies", name: "Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "diagnostics_var_prof_fees_contracted_services", name: "Professional Fees - Contracted Services", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "diagnostics_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "diagnostics_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 10 },
        { row_key: "diagnostics_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 11 },
        { row_key: "diagnostics_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 12 },
        { row_key: "diagnostics_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 13 },
        { row_key: "total_diagnostics_variable_cost", name: "Total Diagnostics Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(diagnostics_var_hourly_wages, diagnostics_var_continuing_education, diagnostics_var_supplies, diagnostics_var_prof_fees_contracted_services, diagnostics_var_taxes_on_payroll, diagnostics_var_taxes_licenses, diagnostics_var_travel_entertainment, diagnostics_var_benefit_load, diagnostics_var_non_productive_time)", display_order: 14 },
        { row_key: "total_diagnostics_variable_ppd", name: "Total Diagnostics Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_diagnostics_variable_cost, pt_days)", display_order: 15 },
        { row_key: "total_diagnostics_cost", name: "Total Diagnostics Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_diagnostics_fixed_cost, total_diagnostics_variable_cost)", display_order: 16 },
        { row_key: "total_diagnostics_ppd", name: "Total Diagnostics PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_diagnostics_cost, pt_days)", display_order: 17 },
      ]
    },
    {
      name: "Rehabilitation",
      display_order: 51,
      rows: [
        { row_key: "rehab_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "total_rehab_fixed_cost", name: "Total Rehab Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(rehab_fixed_salaried_wages)", display_order: 2 },
        { row_key: "total_rehab_fixed_ppd", name: "Total Rehab Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_rehab_fixed_cost, pt_days)", display_order: 3 },
        { row_key: "rehab_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "rehab_var_physical_therapy", name: "Physical Therapy", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "rehab_var_work_therapy_program", name: "Work Therapy Program", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "rehab_var_ot_st", name: "OT/ST", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "rehab_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "rehab_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "rehab_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 10 },
        { row_key: "rehab_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 11 },
        { row_key: "rehab_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 12 },
        { row_key: "total_rehab_variable_cost", name: "Total Rehab Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(rehab_var_hourly_wages, rehab_var_physical_therapy, rehab_var_work_therapy_program, rehab_var_ot_st, rehab_var_taxes_on_payroll, rehab_var_taxes_licenses, rehab_var_travel_entertainment, rehab_var_benefit_load, rehab_var_non_productive_time)", display_order: 13 },
        { row_key: "total_rehab_variable_ppd", name: "Total Rehab Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_rehab_variable_cost, pt_days)", display_order: 14 },
        { row_key: "total_rehab_cost", name: "Total Rehab Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_rehab_fixed_cost, total_rehab_variable_cost)", display_order: 15 },
        { row_key: "total_rehab_ppd", name: "Total Rehab PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_rehab_cost, pt_days)", display_order: 16 },
      ]
    },
    {
      name: "Transportation",
      display_order: 52,
      rows: [
        { row_key: "transport_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "total_transport_fixed_cost", name: "Total Transport Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(transport_fixed_salaried_wages)", display_order: 2 },
        { row_key: "total_transport_fixed_ppd", name: "Total Transport Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_transport_fixed_cost, pt_days)", display_order: 3 },
        { row_key: "transport_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 4 },
        { row_key: "transport_var_van_maintenance_repairs", name: "Van Maintenance & Repairs", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "transport_var_fuel", name: "Fuel", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "transport_var_prof_fees_transport", name: "Professional Fees - Transport", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "transport_var_interest_expense", name: "Interest Expense", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "transport_var_insurance", name: "Insurance", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "transport_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 10 },
        { row_key: "transport_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 11 },
        { row_key: "transport_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 12 },
        { row_key: "transport_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 13 },
        { row_key: "transport_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 14 },
        { row_key: "total_transport_variable_cost", name: "Total Transport Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(transport_var_hourly_wages, transport_var_van_maintenance_repairs, transport_var_fuel, transport_var_prof_fees_transport, transport_var_interest_expense, transport_var_insurance, transport_var_taxes_on_payroll, transport_var_taxes_licenses, transport_var_travel_entertainment, transport_var_benefit_load, transport_var_non_productive_time)", display_order: 15 },
        { row_key: "total_transport_variable_ppd", name: "Total Transport Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_transport_variable_cost, pt_days)", display_order: 16 },
        { row_key: "total_transport_cost", name: "Total Transport Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_transport_fixed_cost, total_transport_variable_cost)", display_order: 17 },
        { row_key: "total_transport_ppd", name: "Total Transport PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_transport_cost, pt_days)", display_order: 18 },
      ]
    },
    {
      name: "QAPI",
      display_order: 53,
      rows: [
        { row_key: "qapi_fixed_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "qapi_fixed_dues_subscriptions", name: "Dues & Subscriptions", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "total_qapi_fixed_cost", name: "Total QAPI Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(qapi_fixed_salaried_wages, qapi_fixed_dues_subscriptions)", display_order: 3 },
        { row_key: "total_qapi_fixed_ppd", name: "Total QAPI Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_qapi_fixed_cost, pt_days)", display_order: 4 },
        { row_key: "qapi_var_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 5 },
        { row_key: "qapi_var_contract_services", name: "Contract Services", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "qapi_var_equipment", name: "Equipment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "qapi_var_supplies", name: "Supplies", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "qapi_var_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 9 },
        { row_key: "qapi_var_taxes_licenses", name: "Taxes & Licenses", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 10 },
        { row_key: "qapi_var_travel_entertainment", name: "Travel & Entertainment", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 11 },
        { row_key: "qapi_var_benefit_load", name: "Benefit Load", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 12 },
        { row_key: "qapi_var_non_productive_time", name: "Non-Productive Time", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 13 },
        { row_key: "total_qapi_variable_cost", name: "Total QAPI Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(qapi_var_hourly_wages, qapi_var_contract_services, qapi_var_equipment, qapi_var_supplies, qapi_var_taxes_on_payroll, qapi_var_taxes_licenses, qapi_var_travel_entertainment, qapi_var_benefit_load, qapi_var_non_productive_time)", display_order: 14 },
        { row_key: "total_qapi_variable_ppd", name: "Total QAPI Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_qapi_variable_cost, pt_days)", display_order: 15 },
        { row_key: "total_qapi_cost", name: "Total QAPI Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_qapi_fixed_cost, total_qapi_variable_cost)", display_order: 16 },
        { row_key: "total_qapi_ppd", name: "Total QAPI PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_qapi_cost, pt_days)", display_order: 17 },
      ]
    },
    {
      name: "Other Expenses",
      display_order: 54,
      rows: [
        { row_key: "other_fixed_depreciation", name: "Depreciation", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 1 },
        { row_key: "other_fixed_interest_expense", name: "Interest Expense", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 2 },
        { row_key: "other_fixed_amortization", name: "Amortization", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 3 },
        { row_key: "total_other_fixed_cost", name: "Total Other Fixed Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(other_fixed_depreciation, other_fixed_interest_expense, other_fixed_amortization)", display_order: 4 },
        { row_key: "total_other_fixed_ppd", name: "Total Other Fixed PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_other_fixed_cost, pt_days)", display_order: 5 },
        { row_key: "other_var_management_fee", name: "Management Fee", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 6 },
        { row_key: "other_var_bank_loc_note_interest_only", name: "Bank LOC/Note Interest Only", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 7 },
        { row_key: "total_other_variable_cost", name: "Total Other Variable Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(other_var_management_fee, other_var_bank_loc_note_interest_only)", display_order: 8 },
        { row_key: "total_other_variable_ppd", name: "Total Other Variable PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_other_variable_cost, pt_days)", display_order: 9 },
        { row_key: "total_other_expenses_cost", name: "Total Other Expenses Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_other_fixed_cost, total_other_variable_cost)", display_order: 10 },
        { row_key: "total_other_expenses_ppd", name: "Total Other Expenses PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_other_expenses_cost, pt_days)", display_order: 11 },
      ]
    },
    {
      name: "Totals / Financial Summary",
      display_order: 55,
      rows: [
        { row_key: "total_operating_revenue", name: "Total Operating Revenue", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_medicare_revenue, total_utilization_other_revenue, total_net_program_revenue)", display_order: 1 },
        { row_key: "total_operating_revenue_ppd", name: "Total Operating Revenue PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_operating_revenue, pt_days)", display_order: 2 },
        { row_key: "total_operating_expense", name: "Total Operating Expense", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_administration_cost, total_billing_cost, total_clinical_services_cost, total_service_development_cost, total_dietary_cost, total_housekeeping_cost, total_hr_cost, total_laboratory_cost, total_medical_records_cost, total_nursing_cost, total_pharmacy_cost, total_environment_of_care_cost, total_diagnostics_cost, total_rehab_cost, total_transport_cost, total_qapi_cost, total_other_expenses_cost)", display_order: 3 },
        { row_key: "total_operating_expense_ppd", name: "Total Operating Expense PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_operating_expense, pt_days)", display_order: 4 },
        { row_key: "net_income_loss", name: "Net Income (Loss)", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUB(total_operating_revenue, total_operating_expense)", display_order: 5 },
        { row_key: "depreciation", name: "Depreciation", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(other_fixed_depreciation)", display_order: 6 },
        { row_key: "interest_expense", name: "Interest Expense", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(other_fixed_interest_expense)", display_order: 7 },
        { row_key: "amortization", name: "Amortization", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(other_fixed_amortization)", display_order: 8 },
        { row_key: "ebitda", name: "EBITDA", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(net_income_loss, depreciation, interest_expense, amortization)", display_order: 9 },
        { row_key: "ebitda_ppd", name: "EBITDA PPD", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(ebitda, pt_days)", display_order: 10 },
      ]
    },
    {
      name: "Operational Cost Rollups",
      display_order: 56,
      rows: [
        { row_key: "total_administration_rollup", name: "Total Administration", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_administration_cost)", display_order: 1 },
        { row_key: "total_billing_rollup", name: "Total Billing", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_billing_cost)", display_order: 2 },
        { row_key: "total_clinical_services_rollup", name: "Total Clinical Services", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_clinical_services_cost)", display_order: 3 },
        { row_key: "total_service_development_rollup", name: "Total Service Development", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_service_development_cost)", display_order: 4 },
        { row_key: "total_dietary_rollup", name: "Total Dietary", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_dietary_cost)", display_order: 5 },
        { row_key: "total_housekeeping_rollup", name: "Total Housekeeping", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_housekeeping_cost)", display_order: 6 },
        { row_key: "total_human_resources_rollup", name: "Total Human Resources", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_hr_cost)", display_order: 7 },
        { row_key: "total_laboratory_rollup", name: "Total Laboratory", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_laboratory_cost)", display_order: 8 },
        { row_key: "total_medical_records_rollup", name: "Total Medical Records", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_medical_records_cost)", display_order: 9 },
        { row_key: "total_nursing_rollup", name: "Total Nursing", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_nursing_cost)", display_order: 10 },
        { row_key: "total_pharmacy_rollup", name: "Total Pharmacy", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_pharmacy_cost)", display_order: 11 },
        { row_key: "total_environment_of_care_rollup", name: "Total Environment of Care", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_environment_of_care_cost)", display_order: 12 },
        { row_key: "total_diagnostics_rollup", name: "Total Diagnostics", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_diagnostics_cost)", display_order: 13 },
        { row_key: "total_rehabilitation_rollup", name: "Total Rehabilitation", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_rehab_cost)", display_order: 14 },
        { row_key: "total_transportation_rollup", name: "Total Transportation", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_transport_cost)", display_order: 15 },
        { row_key: "total_qapi_rollup", name: "Total QAPI", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_qapi_cost)", display_order: 16 },
        { row_key: "total_other_expenses_rollup", name: "Total Other Expenses", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_other_expenses_cost)", display_order: 17 },
        { row_key: "total_operational_cost", name: "Total Operational Cost", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_administration_rollup, total_billing_rollup, total_clinical_services_rollup, total_service_development_rollup, total_dietary_rollup, total_housekeeping_rollup, total_human_resources_rollup, total_laboratory_rollup, total_medical_records_rollup, total_nursing_rollup, total_pharmacy_rollup, total_environment_of_care_rollup, total_diagnostics_rollup, total_rehabilitation_rollup, total_transportation_rollup, total_qapi_rollup, total_other_expenses_rollup)", display_order: 18 },
      ]
    },
    {
      name: "Payroll Summary",
      display_order: 57,
      rows: [
        { row_key: "payroll_salaried_wages", name: "Salaried Wages", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(admin_fixed_salaried_wages, billing_fixed_salaried_wages, clinical_fixed_salaried_wages, svcdev_fixed_salaried_wages, dietary_fixed_salaried_wages, housekeeping_fixed_salaried_wages, hr_fixed_salaried_wages, medrec_fixed_salaried_wages, nursing_fixed_salaried_wages, pharmacy_fixed_salaried_wages, eoc_fixed_salaried_wages, diagnostics_fixed_salaried_wages, rehab_fixed_salaried_wages, transport_fixed_salaried_wages, qapi_fixed_salaried_wages)", display_order: 1 },
        { row_key: "payroll_hourly_wages", name: "Hourly Wages", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(admin_var_hourly_wages, billing_var_hourly_wages, clinical_var_hourly_wages, svcdev_var_hourly_wages, dietary_var_hourly_wages, housekeeping_var_hourly_wages, hr_var_hourly_wages, medrec_var_hourly_wages, nursing_var_hourly_wages, pharmacy_var_hourly_wages, eoc_var_hourly_wages, diagnostics_var_hourly_wages, rehab_var_hourly_wages, transport_var_hourly_wages, qapi_var_hourly_wages)", display_order: 2 },
        { row_key: "payroll_line_staff_rn_matrix", name: "Line Staff RN Matrix", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(nursing_var_line_staff_rn_matrix)", display_order: 3 },
        { row_key: "payroll_line_staff_lpn_matrix", name: "Line Staff LPN Matrix", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(nursing_var_line_staff_lpn_matrix)", display_order: 4 },
        { row_key: "payroll_line_staff_cna_matrix", name: "Line Staff CNA Matrix", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(nursing_var_line_staff_cna_matrix, nursing_var_acuity_line_staff_cna_matrix)", display_order: 5 },
        { row_key: "total_wages_93_pct", name: "Total Wages (93%)", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "MULT(SUM(payroll_salaried_wages, payroll_hourly_wages, payroll_line_staff_rn_matrix, payroll_line_staff_lpn_matrix, payroll_line_staff_cna_matrix), 0.93)", display_order: 6 },
        { row_key: "payroll_taxes_on_payroll", name: "Taxes on Payroll", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(admin_var_taxes_on_payroll, billing_var_taxes_on_payroll, clinical_var_taxes_on_payroll, svcdev_var_taxes_on_payroll, dietary_var_taxes_on_payroll, housekeeping_var_taxes_on_payroll, hr_var_taxes_on_payroll, medrec_var_taxes_on_payroll, nursing_var_taxes_on_payroll, pharmacy_var_taxes_on_payroll, eoc_var_taxes_on_payroll, diagnostics_var_taxes_on_payroll, rehab_var_taxes_on_payroll, transport_var_taxes_on_payroll, qapi_var_taxes_on_payroll)", display_order: 7 },
        { row_key: "payroll_employee_contribution", name: "Employee Contribution", data_type: "currency", entry_mode: "both", calculation_type: "manual", display_order: 8 },
        { row_key: "total_gross_payroll", name: "Total Gross Payroll", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "SUM(total_wages_93_pct, payroll_taxes_on_payroll, payroll_employee_contribution)", display_order: 9 },
        { row_key: "weekly_gross_amount", name: "Weekly Gross Amount", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_gross_payroll, 4)", display_order: 10 },
        { row_key: "payroll_contribution_bi_weekly", name: "Payroll Contribution Bi-Weekly", data_type: "currency", entry_mode: "both", calculation_type: "calculated", formula: "DIV(total_gross_payroll, 2)", display_order: 11 },
      ]
    },
  ]
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting budget structure seed...');

    // Create Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get JWT token to verify the user is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.log('Invalid user:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User verified:', user.id);

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.log('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify admin role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!roleData) {
      console.log('User is not admin');
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin verified, starting seed...');

    // Check if sections already exist
    const { data: existingSections, error: checkError } = await supabase
      .from('budget_sections')
      .select('id')
      .limit(1);

    if (checkError) {
      console.log('Error checking existing sections:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check existing data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingSections && existingSections.length > 0) {
      console.log('Budget structure already seeded');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Budget structure already exists. Clear existing data first if you want to re-seed.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert sections and rows
    let sectionsCreated = 0;
    let rowsCreated = 0;

    for (const section of defaultBudgetStructure.sections) {
      console.log(`Creating section: ${section.name}`);
      
      // Insert section
      const { data: sectionData, error: sectionError } = await supabase
        .from('budget_sections')
        .insert({
          name: section.name,
          display_order: section.display_order,
          is_active: true
        })
        .select('id')
        .single();

      if (sectionError) {
        console.error(`Error creating section ${section.name}:`, sectionError);
        return new Response(
          JSON.stringify({ error: `Failed to create section: ${section.name}`, details: sectionError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      sectionsCreated++;

      // Insert rows for this section
      const rowsToInsert = section.rows.map(row => ({
        section_id: sectionData.id,
        row_key: row.row_key,
        name: row.name,
        data_type: row.data_type,
        entry_mode: row.entry_mode,
        calculation_type: row.calculation_type,
        formula: row.formula || null,
        display_order: row.display_order,
        is_active: true
      }));

      const { error: rowsError } = await supabase
        .from('budget_rows')
        .insert(rowsToInsert);

      if (rowsError) {
        console.error(`Error creating rows for section ${section.name}:`, rowsError);
        return new Response(
          JSON.stringify({ error: `Failed to create rows for section: ${section.name}`, details: rowsError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      rowsCreated += rowsToInsert.length;
    }

    console.log(`Seed complete: ${sectionsCreated} sections, ${rowsCreated} rows created`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully seeded ${sectionsCreated} sections and ${rowsCreated} rows` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
