import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Download, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generateBudgetCSV, downloadCSV, generateBudgetFilename, parseRowKeyFromCSV } from '@/lib/budget-export';

interface Facility {
  id: string;
  name: string;
  code: string;
}

interface Unit {
  id: string;
  name: string;
}

interface BudgetRow {
  id: string;
  row_key: string;
  name: string;
  calculation_type: string;
  entry_mode: string;
}

interface ParsedRow {
  csvName: string;
  matchedRow: BudgetRow | null;
  values: number[];
  matched: boolean;
}

interface CSVImportDialogProps {
  selectedYear: number;
  budgetYearId: string | null;
  onImportComplete: () => void;
  preselectedFacility?: string | null;
  preselectedUnit?: string | null;
}

// Mapping from CSV row names to budget row keys
// This uses a context-aware approach - we track which section we're in
const CSV_ROW_MAPPING: Record<string, string> = {
  // Beds & Days - these appear at the very top of the CSV
  'Acute Psych Total Number of Allocated Beds': 'psych_total_number_of_beds',
  'Total Number of Beds': 'psych_total_number_of_beds',
  'Psych Total Number of Beds': 'psych_total_number_of_beds',
  'Number of Beds': 'psych_total_number_of_beds',
  'Days in Month': 'days_in_month',
  'Days In Month': 'days_in_month',
  'Weekdays': 'weekdays',
  'Week Days': 'weekdays',
  'Weekend Days': 'weekend_days',
  'Weekend days': 'weekend_days',
  
  // Medicare Inpatient Utilization - base mappings
  'Medicare Inpatient Utilization': 'medicare_inpatient_utilization',
  'ADC': 'adc',
  'OCC Rate': 'occ_rate',
  'Occupancy Rate': 'occ_rate',
  'Occupany Rate': 'occ_rate',  // typo in CSV
  
  // Medicare Utilization Percentages
  'Total Utilization': 'total_utilization_pct',
  'Total Utilization %': 'total_utilization_pct',
  
  // Inpatient Utilization Other
  'Other Admits': 'other_admits',
  'Average Length of Stay': 'other_alos',
  'Other ALOS': 'other_alos',
  'Other Patient Days': 'other_patient_days',
  'Average Daily Census': 'other_adc',
  'Other ADC': 'other_adc',
  'Other Occupancy Rate': 'other_occupancy_rate',
  'Total Utilization Other': 'total_utilization_other',
  
  // Payer Mix mappings
  'Contract Rate': 'other_contract_rate_util',
  'Other Medicare': 'other_contract_rate_util',
  'Other Medicare Util %': 'other_contract_rate_util',
  
  // Total Inpatient Patient Days - full row name mappings
  'Total Contract Rate Patient Days': 'total_contract_rate_pt_days',
  'Total Medicare Patient Days': 'total_contract_rate_pt_days',
  'Total Medicare Advantage Patient Days': 'total_medicare_adv_pt_days',
  'Total Commercial Patient Days': 'total_commercial_pt_days',
  'Total Medicaid Patient Days': 'total_medicaid_pt_days',
  'Total Private Pay Patient Days': 'total_private_pay_pt_days',
  'Total Charity/Indigent Patient Days': 'total_charity_indigent_pt_days',
  'Total Patient Days': 'total_patient_days',
  
  // Total Inpatient Avg PPD by Payer - full row name mappings
  'Total Contract Rate Avg PPD': 'total_contract_rate_avg_ppd',
  'Total Medicare Avg PPD': 'total_contract_rate_avg_ppd',
  'Total Medicaid Avg PPD': 'total_medicaid_avg_ppd',
  'Total Medicare Advantage Avg PPD': 'total_medicare_adv_avg_ppd',
  'Total Commercial Avg PPD': 'total_commercial_avg_ppd',
  'Total Private Pay Avg PPD': 'total_private_pay_avg_ppd',
  'Total Charity/Indigent Avg PPD': 'total_charity_indigent_avg_ppd',
  
  // Revenue totals
  'Total Medicare Revenue': 'total_medicare_revenue',
  'Medicare Revenue Avg PPD': 'medicare_revenue_avg_ppd',
  'Total Utilization Other Revenue': 'total_utilization_other_revenue',
  'Total Utilization Other Revenue ': 'total_utilization_other_revenue', // with trailing space
  'Utilization Other Avg PPD': 'utilization_other_avg_ppd',
  'Total Net Program Revenue': 'total_net_program_revenue',
  'Net Program Avg Rev PPD': 'net_program_avg_rev_ppd',
  
  // Gross Revenue with typo
  'Commericial': 'other_commercial_gross_rev',
  
  // Bad Debt
  'Less: Bad Debt': 'less_bad_debt',
  
  // Medicare Pt Days section
  'Total Medicare Pt Days': 'total_medicare_pt_days',
  
  // Total Inpatient Utilization section
  'Total Inpatient Utilization': 'total_inpatient_utilization',
  
  // Administration Variable - additional items
  'Penalties & Fines': 'admin_var_penalties_fines',
  
  // QAPI section mappings
  'Dues and Subscriptions': 'qapi_fixed_dues_subscriptions',
  'Dues and Subscriptions ': 'qapi_fixed_dues_subscriptions',
  'Contract Services': 'qapi_var_contract_services',
  'Equipment': 'qapi_var_equipment',
  'Equipment ': 'qapi_var_equipment',
  
  // Transportation Variable - direct mappings (for standalone rows)
  'Van Maintenance/Repairs': 'transport_var_van_maintenance_repairs',
  'Van Maintenance & Repairs': 'transport_var_van_maintenance_repairs',
  'Fuel': 'transport_var_fuel',
  'Professional Fees - Transport': 'transport_var_prof_fees_transport',

  // Transportation section-specific mappings
  'Van Maintenance/Repairs ': 'transport_var_van_maintenance_repairs',
  'Insurance ': 'transport_var_insurance',
  
  // Other Expenses
  'Management Fees': 'other_exp_management_fees',
  'Amortization': 'other_exp_amortization',
  'Bank LOC Note - interest only': 'other_exp_bank_loc_interest',
};

// Section-aware mappings - CSV name -> section context -> row_key
const SECTION_AWARE_MAPPING: Record<string, Record<string, string>> = {
  // Beds and Days section
  'Days in Month': {
    'Beds and Days': 'days_in_month',
  },
  'Weekdays': {
    'Beds and Days': 'weekdays',
  },
  'Weekend Days': {
    'Beds and Days': 'weekend_days',
  },
  // Patient Days can appear in multiple sections with different meanings
  'Patient Days': {
    'Medicare Inpatient Utilization': 'pt_days',
    'Revenue': 'pt_days',
    'Beds and Days': 'pt_days',
    'Inpatient Utilization Other': 'other_patient_days',
    'Total Inpatient Utilization': 'total_pt_days',
  },
  'Pt Days': {
    'Medicare Inpatient Utilization': 'pt_days',
    'Revenue': 'pt_days',
  },
  // Admits can appear in multiple sections
  'Admits': {
    'Medicare Inpatient Utilization': 'admits',
    'Revenue': 'admits',
    'Inpatient Utilization Other': 'other_admits',
    'Total Inpatient Utilization': 'total_admits',
  },
  // ALOS
  'ALOS': {
    'Medicare Inpatient Utilization': 'alos',
    'Revenue': 'alos',
    'Inpatient Utilization Other': 'other_alos',
    'Total Inpatient Utilization': 'total_alos',
  },
  // ADC
  'ADC': {
    'Medicare Inpatient Utilization': 'adc',
    'Inpatient Utilization Other': 'other_adc',
    'Total Inpatient Utilization': 'total_adc',
  },
  // Occupancy Rate
  'OCC Rate': {
    'Medicare Inpatient Utilization': 'occ_rate',
  },
  'Occupancy Rate': {
    'Inpatient Utilization Other': 'other_occupancy_rate',
    'Medicare Inpatient Utilization': 'occ_rate',
  },
  'Occupany Rate': {  // typo in CSV
    'Total Inpatient Utilization': 'total_occupancy_rate',
  },
  // Medicare Inpatient Patient Days section
  'Medicare': {
    'Medicare Inpatient Patient Days': 'medicare_pt_days',
    'Medicare Utilization Percentages': 'trad_medicare_util_pct',
    'Total Inpatient Patient Days': 'total_medicare_pt_days',
    'Total Inpatient Avg PPD by Payer': 'total_medicare_avg_ppd',
    'Total Inpatient Program Revenue': 'total_medicare_program_rev',
  },
  'Medicare Advantage': {
    'Medicare Inpatient Patient Days': 'medicare_adv_pt_days',
    'Medicare Inpatient Revenue by PPD': 'medicare_adv_rev_ppd',
    'Medicare Utilization Percentages': 'medicare_adv_util_pct',
    'Total Inpatient Patient Days': 'total_medicare_adv_pt_days',
    'Total Inpatient Avg PPD by Payer': 'total_medicare_adv_avg_ppd',
    'Total Inpatient Program Revenue': 'total_medicare_adv_program_rev',
    'Medicare Inpatient Gross Revenue': 'medicare_adv_gross_rev',
  },
  'Total Medicare Pt Days': {
    'Medicare Inpatient Patient Days': 'total_medicare_pt_days',
  },
  // Medicare Inpatient Revenue by PPD section
  'Traditional Medicare': {
    'Medicare Inpatient Revenue by PPD': 'trad_medicare_rev_ppd',
    'Medicare Utilization Percentages': 'trad_medicare_util_pct',
    'Medicare Inpatient Gross Revenue': 'trad_medicare_gross_rev',
    'Total Inpatient Program Revenue': 'total_medicare_program_rev',
  },
  // Inpatient Utilization Other Payer Mix section
  'Commercial': {
    'Inpatient Utilization Other Patient Days': 'other_contract_rate_pt_days',
    'Other Payer Mix': 'other_contract_rate_util',
    'Inpatient Ultization Other Payer Mix': 'other_contract_rate_util',
    'Total Inpatient Patient Days': 'total_commercial_pt_days',
    'Total Inpatient Avg PPD by Payer': 'total_commercial_avg_ppd',
    'Gross Revenue by Payer': 'other_contract_rate_gross_rev',
    'Inpatient Utilization Other Revenue by PPD': 'other_commercial_rev_ppd',
    'Inpatient Utilization Other Gross Revenue': 'other_commercial_gross_rev',
    'Total Inpatient Program Revenue': 'total_commercial_program_rev',
  },
  'Medicaid': {
    'Inpatient Utilization Other Patient Days': 'other_medicaid_pt_days',
    'Other Payer Mix': 'other_medicaid_util',
    'Inpatient Ultization Other Payer Mix': 'other_medicaid_util',
    'Total Inpatient Patient Days': 'total_medicaid_pt_days',
    'Total Inpatient Avg PPD by Payer': 'total_medicaid_avg_ppd',
    'Gross Revenue by Payer': 'other_medicaid_gross_rev',
    'Inpatient Utilization Other Revenue by PPD': 'other_medicaid_rev_ppd',
    'Inpatient Utilization Other Gross Revenue': 'other_medicaid_gross_rev',
    'Total Inpatient Program Revenue': 'total_medicaid_program_rev',
  },
  'Private Pay': {
    'Inpatient Utilization Other Patient Days': 'other_private_pay_pt_days',
    'Other Payer Mix': 'other_private_pay_util',
    'Inpatient Ultization Other Payer Mix': 'other_private_pay_util',
    'Total Inpatient Patient Days': 'total_private_pay_pt_days',
    'Total Inpatient Avg PPD by Payer': 'total_private_pay_avg_ppd',
    'Gross Revenue by Payer': 'other_private_pay_gross_rev',
    'Inpatient Utilization Other Revenue by PPD': 'other_private_pay_rev_ppd',
    'Inpatient Utilization Other Gross Revenue': 'other_private_pay_gross_rev',
    'Total Inpatient Program Revenue': 'total_private_pay_program_rev',
  },
  'Charity/Indigent': {
    'Inpatient Utilization Other Patient Days': 'other_charity_indigent_pt_days',
    'Other Payer Mix': 'other_charity_indigent_util',
    'Inpatient Ultization Other Payer Mix': 'other_charity_indigent_util',
    'Total Inpatient Patient Days': 'total_charity_indigent_pt_days',
    'Total Inpatient Avg PPD by Payer': 'total_charity_indigent_avg_ppd',
    'Gross Revenue by Payer': 'other_charity_indigent_gross_rev',
    'Inpatient Utilization Other Revenue by PPD': 'other_charity_indigent_rev_ppd',
    'Inpatient Utilization Other Gross Revenue': 'other_charity_indigent_gross_rev',
    'Total Inpatient Program Revenue': 'total_charity_program_rev',
  },
  'Contract Rate': {
    'Total Inpatient Patient Days': 'total_contract_rate_pt_days',
    'Total Inpatient Avg PPD by Payer': 'total_contract_rate_avg_ppd',
    'Gross Revenue by Payer': 'other_contract_rate_gross_rev',
    'Total Inpatient Program Revenue': 'total_contract_rate_program_rev',
  },
  // Medicare variations (mapped to Contract Rate row keys)
  'Other Medicare': {
    'Inpatient Utilization Other Patient Days': 'other_contract_rate_pt_days',
    'Other Payer Mix': 'other_contract_rate_util',
    'Inpatient Ultization Other Payer Mix': 'other_contract_rate_util',
    'Inpatient Utilization Other Payer Mix': 'other_contract_rate_util',
    'Inpatient Utilization Other Gross Revenue': 'other_contract_rate_gross_rev',
    'Gross Revenue by Payer': 'other_contract_rate_gross_rev',
    'Total Inpatient Patient Days': 'total_contract_rate_pt_days',
    'Total Inpatient Avg PPD by Payer': 'total_contract_rate_avg_ppd',
    'Total Inpatient Program Revenue': 'total_contract_rate_program_rev',
  },
  'Other Medicare Patient Days': {
    'Inpatient Utilization Other Patient Days': 'other_contract_rate_pt_days',
  },
  'Other Medicare Gross Revenue': {
    'Inpatient Utilization Other Gross Revenue': 'other_contract_rate_gross_rev',
  },
  'Total Utilization Patient Days': {
    'Inpatient Utilization Other Patient Days': 'total_utilization_patient_days',
  },
  'Salaried Wages': {
    'Administration - Fixed Cost': 'admin_fixed_salaried_wages',
    'Billing - Fixed Cost': 'billing_fixed_salaried_wages',
    'Clinical Services - Fixed Cost': 'clinical_fixed_salaried_wages',
    'Service Development - Fixed Cost': 'svcdev_fixed_salaried_wages',
    'Dietary - Fixed Cost': 'dietary_fixed_salaried_wages',
    'Housekeeping - Fixed Cost': 'housekeeping_fixed_salaried_wages',
    'Human Resources - Fixed Cost': 'hr_fixed_salaried_wages',
    'Medical Records - Fixed Cost': 'med_records_fixed_salaried_wages',
    'Nursing - Fixed Cost': 'nursing_fixed_salaried_wages',
    'Pharmacy - Fixed Cost': 'pharmacy_fixed_salaried_wages',
    'Environment of Care - Fixed Cost': 'eoc_fixed_salaried_wages',
    'Diagnostics - Fixed Cost': 'diagnostics_fixed_salaried_wages',
    'Rehabilitation Services - Fixed Cost': 'rehab_fixed_salaried_wages',
    'Social Services - Fixed Cost': 'social_services_fixed_salaried_wages',
    'Activity Therapy - Fixed Cost': 'activity_fixed_salaried_wages',
    'Quality Assurance - Fixed Cost': 'qa_fixed_salaried_wages',
    'Utilization Review - Fixed Cost': 'ur_fixed_salaried_wages',
    'Transportation Services - Fixed Cost': 'transport_fixed_salaried_wages',
    'Transportation - Fixed Cost': 'transport_fixed_salaried_wages',
  },
  'Hourly Wages': {
    'Administration - Variable Cost': 'admin_var_hourly_wages',
    'Billing - Variable Cost': 'billing_var_hourly_wages',
    'Clinical Services - Variable Cost': 'clinical_var_hourly_wages',
    'Service Development - Variable Cost': 'svcdev_var_hourly_wages',
    'Dietary - Variable Cost': 'dietary_var_hourly_wages',
    'Housekeeping - Variable Cost': 'housekeeping_var_hourly_wages',
    'Human Resources - Variable Cost': 'hr_var_hourly_wages',
    'Medical Records - Variable Cost': 'med_records_var_hourly_wages',
    'Nursing - Variable Cost': 'nursing_var_hourly_wages',
    'Pharmacy - Variable Cost': 'pharmacy_var_hourly_wages',
    'Environment of Care - Variable Cost': 'eoc_var_hourly_wages',
    'Diagnostics - Variable Cost': 'diagnostics_var_hourly_wages',
    'Rehabilitation - Variable Cost': 'rehab_var_hourly_wages',
    'Social Services - Variable Cost': 'social_services_var_hourly_wages',
    'Activity Therapy - Variable Cost': 'activity_var_hourly_wages',
    'Quality Assurance - Variable Cost': 'qa_var_hourly_wages',
    'Utilization Review - Variable Cost': 'ur_var_hourly_wages',
    'Transportation - Variable Cost': 'transport_var_hourly_wages',
  },
  'Bonus': {
    'Administration - Variable Cost': 'admin_var_bonus',
    'Nursing - Variable Cost': 'nursing_var_bonus',
    'Service Development - Variable Cost': 'service_dev_var_bonus',
  },
  'Bonus ': {  // with trailing space
    'Service Development - Variable Cost': 'service_dev_var_bonus',
  },
  'Continuing Education': {
    'Administration - Variable Cost': 'admin_var_continuing_education',
    'Nursing - Variable Cost': 'nursing_var_continuing_ed',
    'Medical Records - Variable Cost': 'med_records_var_continuing_ed',
    'Social Services - Variable Cost': 'social_services_var_continuing_ed',
    'Diagnostics - Variable Cost': 'diagnostics_var_continuing_ed',
  },
  'Equipment Rental': {
    'Administration - Variable Cost': 'admin_var_equipment_rental',
    'Environment of Care - Variable Cost': 'eoc_var_equipment_rental',
  },
  'Office Supplies': {
    'Administration - Variable Cost': 'admin_var_office_supplies',
  },
  'Office supplies': {
    'Nursing - Variable Cost': 'nursing_var_office_supplies',
  },
  'Supplies': {
    'Clinical Services - Variable Cost': 'clinical_var_supplies',
    'Dietary - Variable Cost': 'dietary_var_supplies',
    'Housekeeping - Variable Cost': 'housekeeping_var_supplies',
    'Medical Records - Variable Cost': 'med_records_var_supplies',
    'Environment of Care - Variable Cost': 'eoc_var_supplies',
    'Diagnostics - Variable Cost': 'diagnostics_var_supplies',
    'QAPI - Variable Cost': 'qapi_var_supplies',
    'Pharmacy - Variable Cost': 'pharmacy_var_supplies',
  },
  'Patient Supplies': {
    'Nursing - Variable Cost': 'nursing_var_patient_supplies',
  },
  'Taxes on Payroll': {
    'Administration - Variable Cost': 'admin_var_taxes_on_payroll',
    'Billing - Variable Cost': 'billing_var_payroll_taxes',
    'Clinical Services - Variable Cost': 'clinical_var_taxes_on_payroll',
    'Service Development - Variable Cost': 'service_dev_var_payroll_taxes',
    'Human Resources - Variable Cost': 'hr_var_payroll_taxes',
    'Medical Records - Variable Cost': 'med_records_var_payroll_taxes',
    'Nursing - Variable Cost': 'nursing_var_payroll_taxes',
    'Environment of Care - Variable Cost': 'eoc_var_payroll_taxes',
    'Social Services - Variable Cost': 'social_services_var_payroll_taxes',
    'Activity Therapy - Variable Cost': 'activity_var_payroll_taxes',
    'Quality Assurance - Variable Cost': 'qa_var_payroll_taxes',
    'Utilization Review - Variable Cost': 'ur_var_payroll_taxes',
    'QAPI - Variable Cost': 'qapi_var_payroll_taxes',
    'Transportation - Variable Cost': 'transport_var_taxes_on_payroll',
  },
  'Taxes & Licenses': {
    'Administration - Variable Cost': 'admin_var_taxes_licenses',
    'Clinical Services - Variable Cost': 'clinical_var_taxes_licenses',
    'Transportation - Variable Cost': 'transport_var_taxes_licenses',
    'QAPI - Variable Cost': 'qapi_var_taxes_licenses',
  },
  'Benefit Load': {
    'Administration - Variable Cost': 'admin_var_benefit_load',
    'Billing - Variable Cost': 'billing_var_benefits',
    'Clinical Services - Variable Cost': 'clinical_var_benefit_load',
    'Service Development - Variable Cost': 'service_dev_var_benefits',
    'Human Resources - Variable Cost': 'hr_var_benefits',
    'Medical Records - Variable Cost': 'med_records_var_benefits',
    'Nursing - Variable Cost': 'nursing_var_benefits',
    'Environment of Care - Variable Cost': 'eoc_var_benefits',
    'Social Services - Variable Cost': 'social_services_var_benefits',
    'Activity Therapy - Variable Cost': 'activity_var_benefits',
    'Quality Assurance - Variable Cost': 'qa_var_benefits',
    'Utilization Review - Variable Cost': 'ur_var_benefits',
    'QAPI - Variable Cost': 'qapi_var_benefits',
    'Transportation - Variable Cost': 'transport_var_benefit_load',
  },
  'Non productive time': {
    'Administration - Variable Cost': 'admin_var_non_productive_time',
    'Billing - Variable Cost': 'billing_var_non_productive',
    'Clinical Services - Variable Cost': 'clinical_var_non_productive_time',
    'Service Development - Variable Cost': 'service_dev_var_non_productive',
    'Human Resources - Variable Cost': 'hr_var_non_productive',
    'Medical Records - Variable Cost': 'med_records_var_non_productive',
    'Nursing - Variable Cost': 'nursing_var_non_productive',
    'Social Services - Variable Cost': 'social_services_var_non_productive',
    'Activity Therapy - Variable Cost': 'activity_var_non_productive',
    'Quality Assurance - Variable Cost': 'qa_var_non_productive',
    'Utilization Review - Variable Cost': 'ur_var_non_productive',
    'Transportation - Variable Cost': 'transport_var_non_productive_time',
  },
  'Travel & Entertainment': {
    'Administration - Variable Cost': 'admin_var_travel_entertainment',
    'Human Resources - Variable Cost': 'hr_var_travel',
    'Service Development - Variable Cost': 'service_dev_var_travel',
    'Transportation - Variable Cost': 'transport_var_travel_entertainment',
    'QAPI - Variable Cost': 'qapi_var_travel',
  },
  'Postage': {
    'Administration - Variable Cost': 'admin_var_postage',
    'Billing - Variable Cost': 'billing_var_postage',
  },
  'Interest Expense': {
    'Transportation - Variable Cost': 'transport_var_interest_expense',
    'Other Expenses - Fixed Cost': 'other_exp_interest',
  },
  'Insurance': {
    'Transportation - Variable Cost': 'transport_var_insurance',
    'Environment of Care - Fixed Cost': 'eoc_fixed_insurance_property',
  },
  'Van Maintenance & Repairs': {
    'Transportation - Variable Cost': 'transport_var_van_maintenance_repairs',
  },
  'Van Maintenance/Repairs': {
    'Transportation - Variable Cost': 'transport_var_van_maintenance_repairs',
  },
  'Fuel': {
    'Transportation - Variable Cost': 'transport_var_fuel',
  },
  'Professional Fees - Transport': {
    'Transportation - Variable Cost': 'transport_var_prof_fees_transport',
  },
};

// Additional direct mappings for specific items
const ADDITIONAL_MAPPINGS: Record<string, string> = {
  // Administration Fixed
  'Contract Services - Accounting': 'admin_fixed_contract_services_accounting',
  'Dues & subscriptions': 'admin_fixed_dues_subscriptions',
  'Insurance - DO': 'admin_fixed_insurance_do',
  'Software Cost': 'admin_fixed_software_cost',
  'Professional Fees - Governing Body Board Fees': 'admin_fixed_governing_body_fees',
  
  // Administration Variable
  'Bank service charges': 'admin_var_bank_service_charges',
  'Professional Fees - Legal': 'admin_var_prof_fees_legal',
  'Professional Fees - Cost Report': 'admin_var_prof_fees_cost_report',
  'Professional Fees - Software Support': 'admin_var_prof_fees_software_support',
  'Physician Medical Director Duties': 'admin_var_physician_med_director_duties',
  'Physican Sub Committee Duties': 'admin_var_physician_sub_committee_duties',
  'Physician Sub Committee Duties': 'admin_var_physician_sub_committee_duties',
  'Shredding': 'admin_var_shredding',
  'Donations': 'admin_var_donations',
  
  // Billing Fixed
  'Professional Fees - Backend Biller': 'billing_fixed_backend_biller',
  'Professional Fees - Software': 'billing_fixed_software',
  
  // Billing Variable
  'Collection expense': 'billing_var_collection',
  
  // Clinical Services Fixed
  'E.H.R.  Services': 'clinical_fixed_ehr',
  'Insurance - PL': 'clinical_fixed_insurance_pl',
  
  // Clinical Services Variable
  'Professional Fees - Psychiatric On-Call Services': 'clinical_var_prof_fees_psych_oncall',
  'Professional Fees -Medical On-Call Services': 'clinical_var_prof_fees_med_oncall',
  'Professional Fees - Psychiatric On-Call': 'clinical_var_prof_fees_psych_oncall',
  'Professional Fees - Medical On-Call': 'clinical_var_prof_fees_med_oncall',
  
  // Service Development Fixed
  'Professional Fees - Promotional Design, Mgmt, Hosting': 'svcdev_fixed_prof_fees_promo_design_mgmt_hosting',
  '"Professional Fees - Promotional Design, Mgmt, Hosting"': 'svcdev_fixed_prof_fees_promo_design_mgmt_hosting',
  'Car Allowance': 'svcdev_fixed_car_allowance',
  
  // Service Development Variable
  'Public Relations': 'svcdev_var_public_relations',
  'Promotional Supplies': 'svcdev_var_promotional_supplies',
  'Promotional Supplies ': 'svcdev_var_promotional_supplies',  // with trailing space
  
  // Dietary Variable
  'Patient Meals - PPD': 'dietary_var_patient_meals',
  'Professional Fees - Dietary Consult': 'dietary_var_consult',
  
  // Housekeeping Variable
  'Laundry & Linen - Housekeeping': 'housekeeping_var_laundry',
  
  // Human Resources Fixed
  'Software - Payroll': 'hr_fixed_software_payroll',
  'HR Job Postings': 'hr_fixed_job_postings',
  'Job Postings': 'hr_fixed_job_postings',
  
  // Human Resources Variable
  'Background Check/Fingerprints': 'hr_var_background_check_fingerprints',
  'Background Check & Fingerprints': 'hr_var_background_check_fingerprints',
  'Insurance - Unemployment': 'hr_var_insurance_unemployment',
  'Insurance - WC': 'hr_var_insurance_wc',
  'Insurance - Workers Comp': 'hr_var_insurance_wc',
  'Professional Fees- Employee Recruiting': 'hr_var_prof_fees_physician_search',
  'Professional Fees - Employee Recruiting': 'hr_var_prof_fees_physician_search',
  
  // Laboratory
  'Professional Fee - Outside Services - Lab': 'lab_var_prof_fee_outside_services',
  'Professional Fees - Outside Services': 'lab_var_prof_fee_outside_services',
  
  // Medical Records Fixed
  'Contract Services - HIM': 'med_records_fixed_him',
  
  // Nursing Variable
  'Line Staff - RN Matrix': 'nursing_var_rn_matrix',
  'Line Staff - LPN Matrix': 'nursing_var_lpn_matrix',
  'Line Staff - C.N.A Matrix': 'nursing_var_cna_matrix',
  'Laundry & Linen': 'nursing_var_laundry',
  'Laundry & Linen ': 'nursing_var_laundry',  // with trailing space
  'Inhalation therapy': 'nursing_var_inhalation',
  'Patient Supplies': 'nursing_var_patient_supplies',
  'Office supplies': 'nursing_var_office_supplies',
  'Office supplies ': 'nursing_var_office_supplies',  // with trailing space
  
  // Pharmacy Variable
  'Pharmaceutical Products - PPD': 'pharmacy_var_pharmaceutical_products_ppd',
  'Med Dispense': 'pharmacy_var_supplies',
  'Professional fees - PIC': 'pharmacy_fixed_prof_fees_pic',
  
  // Environment of Care Fixed
  'Insurance - Property': 'eoc_fixed_insurance_property',
  'Insurance - GL': 'eoc_fixed_insurance_gl',
  'Lease': 'eoc_fixed_lease',
  'Telephone/Internet': 'eoc_fixed_telephone',
  'Cable television': 'eoc_fixed_cable',
  
  // Environment of Care Variable
  'Contract Services - EOC/Life Safety': 'eoc_var_life_safety',
  'Professional Fees - Maintenance': 'eoc_var_maintenance',
  'Building Repairs': 'eoc_var_building_repairs',
  'Utilities': 'eoc_var_utilities',
  'Waste disposal': 'eoc_var_waste_disposal',
  
  // Diagnostics Variable
  'Professional Fees - Contracted Services': 'diagnostics_var_contracted',
  
  // Rehabilitation Variable
  'Physical therapy': 'rehab_var_physical_therapy',
  'Occupational therapy': 'rehab_var_occupational_therapy',
  'Speech therapy': 'rehab_var_speech_therapy',
  
  // Social Services
  'LCSW Services': 'social_services_var_lcsw',
  
  // Activity Therapy Variable
  'Professional Fees - Music Therapy': 'activity_var_music_therapy',
  'Activity Supplies': 'activity_var_supplies',
  
  // QAPI Fixed
  'Dues and Subscriptions': 'qapi_fixed_dues_subscriptions',
  'Dues and Subscriptions ': 'qapi_fixed_dues_subscriptions',
  
  // QAPI Variable
  'Contract Services': 'qapi_var_contract_services',
  'Equipment': 'qapi_var_equipment',
  'Equipment ': 'qapi_var_equipment',
  
  // Other Expenses - Fixed Cost
  'Management Fees': 'other_fixed_management_fees',
  'Depreciation': 'other_fixed_depreciation',
  'Amortization': 'other_fixed_amortization',
  
  // Other Expenses - Variable Cost
  'Bank LOC Note - interest only': 'other_var_bank_loc_interest',
  'Management Fee': 'other_fixed_management_fees',
  'Management Fee ': 'other_fixed_management_fees',
};

export const CSVImportDialog = React.forwardRef<HTMLDivElement, CSVImportDialogProps>(
  function CSVImportDialog({ selectedYear, budgetYearId, onImportComplete, preselectedFacility, preselectedUnit }, ref) {
  const [open, setOpen] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string>(preselectedFacility || '');
  const [selectedUnit, setSelectedUnit] = useState<string>(preselectedUnit || '');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showOnlyUnmatched, setShowOnlyUnmatched] = useState(false);
  const [showBackupWarning, setShowBackupWarning] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Load units when facility changes
  const loadUnits = async (facilityId: string) => {
    if (!facilityId) {
      setUnits([]);
      return;
    }
    const { data } = await supabase
      .from('units')
      .select('id, name')
      .eq('facility_id', facilityId)
      .eq('is_active', true)
      .order('name');
    setUnits(data || []);
  };

  const handleFacilityChange = (value: string) => {
    setSelectedFacility(value);
    setSelectedUnit('');
    loadUnits(value);
  };

  // Load facilities when dialog opens
  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      const [facilitiesResult, rowsResult] = await Promise.all([
        supabase.from('facilities').select('*').eq('is_active', true).order('name'),
        supabase.from('budget_rows').select('id, row_key, name, calculation_type, entry_mode').eq('is_active', true),
      ]);
      
      if (facilitiesResult.data) {
        setFacilities(facilitiesResult.data);
      }
      if (rowsResult.data) {
        setBudgetRows(rowsResult.data as BudgetRow[]);
      }
      // Load units for preselected facility
      if (preselectedFacility) {
        loadUnits(preselectedFacility);
      }
    } else {
      // Reset state
      setFile(null);
      setParsedData([]);
      setParseError(null);
      setSelectedFacility(preselectedFacility || '');
      setSelectedUnit(preselectedUnit || '');
      setUnits([]);
      setShowBackupWarning(false);
      setHasExistingData(false);
    }
  };

  // Check for existing data when unit is selected
  const checkExistingData = async (unitId: string) => {
    if (!budgetYearId || !unitId) {
      setHasExistingData(false);
      return;
    }
    
    const { count } = await supabase
      .from('budgets')
      .select('*', { count: 'exact', head: true })
      .eq('budget_year_id', budgetYearId)
      .eq('unit_id', unitId);
    
    setHasExistingData((count || 0) > 0);
  };

  // Handle unit selection with data check
  const handleUnitChange = (value: string) => {
    setSelectedUnit(value);
    checkExistingData(value);
  };

  // Download backup of current data
  const downloadBackup = async () => {
    if (!budgetYearId || !selectedUnit) return;
    
    try {
      // Fetch current budget data
      const { data: existingBudgets } = await supabase
        .from('budgets')
        .select('row_id, month, value')
        .eq('budget_year_id', budgetYearId)
        .eq('unit_id', selectedUnit);
      
      if (!existingBudgets || existingBudgets.length === 0) {
        toast({ title: 'No data to backup', description: 'No existing budget data found for this unit' });
        return;
      }
      
      // Transform to values structure
      const currentValues: Record<string, Record<number, number>> = {};
      existingBudgets.forEach((b) => {
        if (!currentValues[b.row_id]) currentValues[b.row_id] = {};
        currentValues[b.row_id][b.month] = Number(b.value);
      });
      
      // Get sections for sorting
      const { data: sections } = await supabase
        .from('budget_sections')
        .select('id, name, display_order, is_active')
        .eq('is_active', true)
        .order('display_order');
      
      // Generate CSV with current data
      const csv = generateBudgetCSV(
        budgetRows as any,
        sections || [],
        currentValues,
        true
      );
      
      const unitName = units.find(u => u.id === selectedUnit)?.name || 'unit';
      const facilityName = facilities.find(f => f.id === selectedFacility)?.name || 'facility';
      const filename = generateBudgetFilename(selectedYear, facilityName, unitName + '-backup', false);
      
      downloadCSV(csv, filename);
      
      toast({
        title: 'Backup downloaded',
        description: `Saved current budget data as ${filename}`,
      });
    } catch (error) {
      console.error('Backup error:', error);
      toast({
        title: 'Backup failed',
        description: 'Failed to download backup',
        variant: 'destructive',
      });
    }
  };

  const parseCSVValue = (value: string): number => {
    if (!value || value.trim() === '') return 0;
    
    // Remove quotes, commas, and percentage signs
    let cleaned = value.replace(/[\"']/g, '').replace(/,/g, '').replace(/%/g, '').trim();
    
    // Handle parentheses for negative numbers
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1);
    }
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const matchRowToKey = useCallback((csvName: string, allRows: BudgetRow[], currentSection: string): BudgetRow | null => {
    const trimmedName = csvName.trim();
    
    // First, try section-aware mapping for items that appear in multiple sections
    const sectionMapping = SECTION_AWARE_MAPPING[trimmedName];
    if (sectionMapping && currentSection) {
      const sectionKey = sectionMapping[currentSection];
      if (sectionKey) {
        const row = allRows.find(r => r.row_key === sectionKey);
        if (row) return row;
      }
    }
    
    // Try additional direct mappings
    const additionalKey = ADDITIONAL_MAPPINGS[trimmedName];
    if (additionalKey) {
      const row = allRows.find(r => r.row_key === additionalKey);
      if (row) return row;
    }
    
    // Try simple direct mapping
    const mappedKey = CSV_ROW_MAPPING[trimmedName];
    if (mappedKey) {
      const row = allRows.find(r => r.row_key === mappedKey);
      if (row) return row;
    }
    
    // Try to find by exact name match
    const exactMatch = allRows.find(r => 
      r.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (exactMatch) return exactMatch;
    
    // Try to find by partial match
    const normalizedCsvName = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const partialMatch = allRows.find(r => {
      const normalizedRowName = r.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedRowName === normalizedCsvName || 
             normalizedRowName.includes(normalizedCsvName) ||
             normalizedCsvName.includes(normalizedRowName);
    });
    
    return partialMatch || null;
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setParseError(null);
    
    try {
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        setParseError('CSV file appears to be empty or invalid');
        return;
      }
      
      // Parse header to get month columns
      const header = lines[0].split(',').map(h => h.trim());
      const monthColumns: number[] = [];
      
      // Check if this is a template-style CSV with row_key column
      const hasRowKeyColumn = header.some(h => h.toLowerCase() === 'row_key');
      const rowKeyIndex = header.findIndex(h => h.toLowerCase() === 'row_key');
      const rowNameIndex = hasRowKeyColumn ? header.findIndex(h => h.toLowerCase() === 'row name') : 0;
      
      // Find month columns - for template CSVs they start after row_key and Row Name
      const monthStartIndex = hasRowKeyColumn ? 2 : 1;
      for (let i = monthStartIndex; i < monthStartIndex + 12 && i < header.length; i++) {
        monthColumns.push(i);
      }
      
      if (monthColumns.length !== 12) {
        setParseError('CSV must have 12 month columns');
        return;
      }
      
      // Parse data rows
      const parsed: ParsedRow[] = [];
      const usedRowIds = new Set<string>(); // Track already-matched rows to avoid duplicates
      let currentSection = 'Beds and Days'; // Start with Beds and Days as initial context
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Handle CSV with quoted values containing commas
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current);
        
        const csvName = values[0]?.trim();
        if (!csvName || csvName === '') continue;
        
        // For template-style CSVs with row_key column, use simplified direct matching
        // This bypasses all the complex section detection and fuzzy matching logic
        if (hasRowKeyColumn && rowKeyIndex >= 0) {
          const rowKey = values[rowKeyIndex]?.trim();
          const displayName = rowNameIndex >= 0 ? values[rowNameIndex]?.trim() || csvName : csvName;
          
          // Skip empty row_key entries
          if (!rowKey) {
            console.log(`Skipping CSV row with empty row_key: "${displayName}"`);
            continue;
          }
          
          // Get month values
          const monthValues = monthColumns.map(colIdx => parseCSVValue(values[colIdx] || ''));
          
          // Skip rows with no values at all
          const hasAnyValue = monthValues.some(v => v !== 0) || 
            monthColumns.some(colIdx => values[colIdx]?.trim() !== '');
          if (!hasAnyValue) {
            console.log(`Skipping CSV row with no values: "${rowKey}"`);
            continue;
          }
          
          // Find matching budget row by row_key
          const matchedRow = budgetRows.find(r => r.row_key === rowKey) || null;
          
          if (matchedRow) {
            console.log(`CSV row matched by row_key: "${rowKey}" -> ${matchedRow.name}`);
            
            // Skip calculated or actual-only rows
            if (matchedRow.calculation_type === 'calculated' || matchedRow.entry_mode === 'actual_only') {
              console.log(`  Skipping calculated/actual-only row: ${matchedRow.row_key}`);
              continue;
            }
            
            // Skip duplicates
            if (usedRowIds.has(matchedRow.id)) {
              console.log(`  Skipping duplicate row: ${matchedRow.row_key}`);
              continue;
            }
            
            usedRowIds.add(matchedRow.id);
          } else {
            console.log(`CSV row not matched by row_key: "${rowKey}"`);
          }
          
          parsed.push({
            csvName: displayName,
            matchedRow,
            values: monthValues,
            matched: !!matchedRow,
          });
          
          continue; // Move to next row - skip legacy section-based matching below
        }
        
        // ============ LEGACY CSV PARSING (no row_key column) ============
        // This section handles CSVs without the row_key column using section-aware fuzzy matching
        
        // Detect section headers (rows with name but no data in columns 1-12)
        // Check if any month column has a value (including 0s that are explicitly set)
        const hasAnyValue = monthColumns.some(colIdx => {
          const val = values[colIdx];
          return val && val.trim() !== '';
        });
        // Check if row has non-zero data (for section detection)
        const hasNonZeroData = monthColumns.some(colIdx => {
          const val = values[colIdx];
          return val && val.trim() !== '' && parseCSVValue(val) !== 0;
        });
        
        // Update current section context based on common section patterns
        // First check for utilization/beds sections at the top of CSV
        if (csvName === 'Acute Psych Total Number of Allocated Beds' || 
            csvName === 'Total Number of Beds' || 
            csvName === 'Psych Total Number of Beds') {
          currentSection = 'Beds and Days';
        } else if (csvName === 'Revenue') {
          currentSection = 'Revenue';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Medicare Inpatient Utilization') {
          currentSection = 'Medicare Inpatient Utilization';
          if (!hasNonZeroData) continue; // Skip section header
        } else if (csvName === 'Medicare Inpatient Utilization Percentages') {
          currentSection = 'Medicare Utilization Percentages';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Medicare Inpatient Patient Days') {
          currentSection = 'Medicare Inpatient Patient Days';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Medicare Inpatient Revenue by PPD') {
          currentSection = 'Medicare Inpatient Revenue by PPD';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Medicare Inpatient Gross Revenue') {
          currentSection = 'Medicare Inpatient Gross Revenue';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Medicare Utilization Percentages') {
          currentSection = 'Medicare Utilization Percentages';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Inpatient Utilization Other') {
          currentSection = 'Inpatient Utilization Other';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Inpatient Ultization Other Payer Mix' || csvName === 'Inpatient Utilization Other Payer Mix') {
          currentSection = 'Inpatient Ultization Other Payer Mix';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Inpatient Utilization Other Patient Days') {
          currentSection = 'Inpatient Utilization Other Patient Days';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Inpatient Utilization Other Revenue by PPD') {
          currentSection = 'Inpatient Utilization Other Revenue by PPD';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Inpatient Utilization Other Gross Revenue') {
          currentSection = 'Inpatient Utilization Other Gross Revenue';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Other Payer Mix' || csvName === 'Payer Mix') {
          currentSection = 'Other Payer Mix';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Total Inpatient Utilization') {
          currentSection = 'Total Inpatient Utilization';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Total Inpatient Patient Days') {
          currentSection = 'Total Inpatient Patient Days';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Total  Inpatient Avg PPD by Payer' || csvName === 'Total Inpatient Avg PPD by Payer' || csvName === 'Total Inpatient Avg PPD') {
          currentSection = 'Total Inpatient Avg PPD by Payer';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Total Inpatient Program Revenue') {
          currentSection = 'Total Inpatient Program Revenue';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Gross Revenue by Payer') {
          currentSection = 'Gross Revenue by Payer';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Other Expenses - Fixed Cost') {
          currentSection = 'Other Expenses - Fixed Cost';
          if (!hasNonZeroData) continue;
        } else if (csvName === 'Other Expenses - Variable Cost') {
          currentSection = 'Other Expenses - Variable Cost';
          if (!hasNonZeroData) continue;
        } else if (!hasNonZeroData || csvName.toLowerCase().includes(' - fixed cost') || 
            csvName.toLowerCase().includes(' - variable cost')) {
          // This is likely a section header for expense sections
          if (csvName.toLowerCase().includes('administration')) currentSection = csvName.includes('Variable') ? 'Administration - Variable Cost' : 'Administration - Fixed Cost';
          else if (csvName.toLowerCase().includes('billing')) currentSection = csvName.includes('Variable') ? 'Billing - Variable Cost' : 'Billing - Fixed Cost';
          else if (csvName.toLowerCase().includes('clinical')) currentSection = csvName.includes('Variable') ? 'Clinical Services - Variable Cost' : 'Clinical Services - Fixed Cost';
          else if (csvName.toLowerCase().includes('service development')) currentSection = csvName.includes('Variable') ? 'Service Development - Variable Cost' : 'Service Development - Fixed Cost';
          else if (csvName.toLowerCase().includes('dietary')) currentSection = csvName.includes('Variable') ? 'Dietary - Variable Cost' : 'Dietary - Fixed Cost';
          else if (csvName.toLowerCase().includes('housekeeping')) currentSection = csvName.includes('Variable') ? 'Housekeeping - Variable Cost' : 'Housekeeping - Fixed Cost';
          else if (csvName.toLowerCase().includes('human resources')) currentSection = csvName.includes('Variable') ? 'Human Resources - Variable Cost' : 'Human Resources - Fixed Cost';
          else if (csvName.toLowerCase().includes('laboratory')) currentSection = csvName.includes('Variable') ? 'Laboratory - Variable Cost' : 'Laboratory - Fixed Cost';
          else if (csvName.toLowerCase().includes('medical records')) currentSection = csvName.includes('Variable') ? 'Medical Records - Variable Cost' : 'Medical Records - Fixed Cost';
          else if (csvName.toLowerCase().includes('nursing')) currentSection = csvName.includes('Variable') ? 'Nursing - Variable Cost' : 'Nursing - Fixed Cost';
          else if (csvName.toLowerCase().includes('pharmacy')) currentSection = csvName.includes('Variable') ? 'Pharmacy - Variable Cost' : 'Pharmacy - Fixed Cost';
          else if (csvName.toLowerCase().includes('environment of care')) currentSection = csvName.includes('Variable') ? 'Environment of Care - Variable Cost' : 'Environment of Care - Fixed Cost';
          else if (csvName.toLowerCase().includes('diagnostics')) currentSection = csvName.includes('Variable') ? 'Diagnostics - Variable Cost' : 'Diagnostics - Fixed Cost';
          else if (csvName.toLowerCase().includes('rehabilitation')) currentSection = csvName.includes('Variable') ? 'Rehabilitation - Variable Cost' : 'Rehabilitation Services - Fixed Cost';
          else if (csvName.toLowerCase().includes('social services')) currentSection = csvName.includes('Variable') ? 'Social Services - Variable Cost' : 'Social Services - Fixed Cost';
          else if (csvName.toLowerCase().includes('activity therapy')) currentSection = csvName.includes('Variable') ? 'Activity Therapy - Variable Cost' : 'Activity Therapy - Fixed Cost';
          else if (csvName.toLowerCase().includes('quality assurance') || csvName.toLowerCase().includes('qapi')) currentSection = csvName.includes('Variable') ? 'QAPI - Variable Cost' : 'QAPI - Fixed Cost';
          else if (csvName.toLowerCase().includes('utilization review')) currentSection = csvName.includes('Variable') ? 'Utilization Review - Variable Cost' : 'Utilization Review - Fixed Cost';
          else if (csvName.toLowerCase().includes('transportation')) currentSection = csvName.includes('Variable') ? 'Transportation - Variable Cost' : 'Transportation Services - Fixed Cost';
          else if (csvName.toLowerCase().includes('other expenses')) currentSection = csvName.includes('Variable') ? 'Other Expenses - Variable Cost' : 'Other Expenses - Fixed Cost';
          
          // Don't skip rows that have data but match section header patterns
          // Only skip if the row truly has no data (is just a section header)
          if (!hasAnyValue) continue;
        }
        
        // Skip total/summary rows (but not specific allowed totals or rows in Total Inpatient sections)
        const isTotalInpatientSection = currentSection === 'Total Inpatient Patient Days' || 
                                        currentSection === 'Total Inpatient Avg PPD by Payer';
        if (csvName.toLowerCase().includes('total') && 
            !isTotalInpatientSection &&
            !csvName.toLowerCase().includes('total patient days') &&
            !csvName.toLowerCase().includes('total number of') &&
            !csvName.toLowerCase().includes('total medicare pt days') &&
            !csvName.toLowerCase().includes('total utilization patient days')) {
          continue;
        }
        
        // Skip rows with no values at all (section headers without any data cells)
        if (!hasAnyValue) continue;
        
        const monthValues = monthColumns.map(colIdx => parseCSVValue(values[colIdx] || ''));
        
        // Use fuzzy name matching for legacy CSVs
        const matchedRow = matchRowToKey(csvName, budgetRows, currentSection);
        
        // Log for debugging
        if (!matchedRow) {
          console.log(`CSV row not matched: "${csvName}" (section: ${currentSection})`);
        } else {
          console.log(`CSV row matched by name: "${csvName}" -> ${matchedRow.row_key} (section: ${currentSection})`);
        }
        
        // Only include manual entry rows
        if (matchedRow && (matchedRow.calculation_type === 'calculated' || matchedRow.entry_mode === 'actual_only')) {
          console.log(`  Skipping calculated/actual-only row: ${matchedRow.row_key}`);
          continue;
        }
        
        // Skip if this row was already matched (avoid duplicates)
        if (matchedRow && usedRowIds.has(matchedRow.id)) {
          console.log(`  Skipping duplicate row: ${matchedRow.row_key}`);
          continue;
        }
        
        if (matchedRow) {
          usedRowIds.add(matchedRow.id);
        }
        
        parsed.push({
          csvName,
          matchedRow,
          values: monthValues,
          matched: !!matchedRow,
        });
      }
      
      setParsedData(parsed);
    } catch (err) {
      setParseError('Failed to parse CSV file');
      console.error('CSV parse error:', err);
    }
  };

  const handleImport = async () => {
    if (!budgetYearId || !user || !selectedFacility || !selectedUnit) {
      toast({
        title: 'Cannot import',
        description: 'Please select a facility and unit first',
        variant: 'destructive',
      });
      return;
    }
    
    const matchedRows = parsedData.filter(p => p.matched && p.matchedRow);
    if (matchedRows.length === 0) {
      toast({
        title: 'No data to import',
        description: 'No matching budget rows found in the CSV',
        variant: 'destructive',
      });
      return;
    }
    
    setImporting(true);
    
    try {
      // Delete existing budget entries for this year/unit
      const { error: deleteError } = await supabase
        .from('budgets')
        .delete()
        .eq('budget_year_id', budgetYearId)
        .eq('unit_id', selectedUnit);
      
      if (deleteError) throw deleteError;
      
      // Build insert data
      const insertData: Array<{
        budget_year_id: string;
        row_id: string;
        month: number;
        value: number;
        created_by: string;
        facility_id: string;
        unit_id: string;
      }> = [];
      
      matchedRows.forEach(row => {
        if (!row.matchedRow) return;
        
        row.values.forEach((value, idx) => {
          insertData.push({
            budget_year_id: budgetYearId,
            row_id: row.matchedRow!.id,
            month: idx + 1,
            value,
            created_by: user.id,
            facility_id: selectedFacility,
            unit_id: selectedUnit,
          });
        });
      });
      
      // Insert in batches
      const batchSize = 500;
      for (let i = 0; i < insertData.length; i += batchSize) {
        const batch = insertData.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from('budgets').insert(batch);
        if (insertError) throw insertError;
      }
      
      toast({
        title: 'Import successful',
        description: `Imported ${matchedRows.length} rows (${insertData.length} values) for ${selectedYear}`,
      });
      
      setOpen(false);
      onImportComplete();
    } catch (err) {
      console.error('Import error:', err);
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const matchedCount = parsedData.filter(p => p.matched).length;
  const unmatchedCount = parsedData.filter(p => !p.matched).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Budget from CSV</DialogTitle>
          <DialogDescription className="space-y-1">
            <span>Upload a CSV file to import budget data for {selectedYear}.</span>
            <span className="block text-xs">
              Tip: Use the Export button on the Budget Entry page to download a template with exact row keys.
            </span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Facility Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Facility</label>
            <Select value={selectedFacility} onValueChange={handleFacilityChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a facility..." />
              </SelectTrigger>
              <SelectContent>
                {facilities.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unit Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Unit</label>
            <Select value={selectedUnit} onValueChange={handleUnitChange} disabled={!selectedFacility}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a unit..." />
              </SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Existing Data Warning */}
          {hasExistingData && selectedUnit && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-amber-700">
                  This unit has existing budget data that will be overwritten.
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={downloadBackup}
                  className="ml-2 text-amber-700 border-amber-500/50 hover:bg-amber-500/20"
                >
                  <Download className="mr-1 h-3 w-3" />
                  Download Backup
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {/* File Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">CSV File</label>
            <div 
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <span className="font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <Upload className="h-8 w-8 mx-auto mb-2" />
                  <p>Click to upload or drag and drop</p>
                  <p className="text-xs">CSV files only</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Parse Error */}
          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}
          
          {/* Parsed Data Preview */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <button 
                    onClick={() => setShowOnlyUnmatched(false)}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                      !showOnlyUnmatched ? 'bg-green-500/20 text-green-600' : 'text-muted-foreground hover:text-green-600'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {matchedCount} matched
                  </button>
                  <button 
                    onClick={() => setShowOnlyUnmatched(true)}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                      showOnlyUnmatched ? 'bg-amber-500/20 text-amber-600' : 'text-muted-foreground hover:text-amber-600'
                    }`}
                  >
                    <AlertCircle className="h-4 w-4" />
                    {unmatchedCount} unmatched
                  </button>
                </div>
                {showOnlyUnmatched && unmatchedCount > 0 && (
                  <span className="text-xs text-muted-foreground">Click to see unmatched CSV row names</span>
                )}
              </div>
              
              <ScrollArea className="h-[250px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {(showOnlyUnmatched ? parsedData.filter(p => !p.matched) : parsedData).map((row, idx) => (
                    <div 
                      key={idx}
                      className={`text-xs px-2 py-1 rounded flex justify-between items-center ${
                        row.matched ? 'bg-green-500/10' : 'bg-amber-500/10 border border-amber-500/30'
                      }`}
                    >
                      <span className="truncate flex-1">
                        <span className={row.matched ? '' : 'font-medium text-amber-700'}>
                          {row.csvName}
                        </span>
                        {row.matchedRow && (
                          <span className="text-muted-foreground ml-2">
                            → {row.matchedRow.name}
                          </span>
                        )}
                        {!row.matched && (
                          <span className="text-amber-600 ml-2 italic">
                            (needs mapping)
                          </span>
                        )}
                      </span>
                      <span className="font-mono ml-2 text-muted-foreground">
                        {row.values.slice(0, 3).map(v => v.toLocaleString()).join(', ')}...
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!selectedFacility || matchedCount === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>Import {matchedCount} Rows</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
