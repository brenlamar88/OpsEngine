import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { format, subDays } from 'date-fns';

export interface DailyOperationsData {
  // Service Development
  inquiries: number;
  referrals: number;
  redTerritoryAdmits: number;
  blueTerritoryAdmits: number;
  whiteTerritoryAdmits: number;
  faceToFaceTouches: number;
  qualityTouches: number;
  inservices: number;
  preScreenedBySdrs: number;
  needsAnalysis: number;
  top3Categories: string;
  discharges: number;
  fiveStarSurveys: number;

  // Census Breakdown Pt Days
  mcrFullDays: number;
  mcrCoDays: number;
  mcrLifetimeDays: number;
  hmoPtDays: number;
  medicaidPtDays: number;
  commercialPtDays: number;
  privatePayPtDays: number;
  charityIndigentPtDays: number;
  elmhsPtDays: number;

  // Budget Revenue Rates
  rateMcrFullDays: number;
  rateMcrCoDays: number;
  rateMcrLifetimeDays: number;
  rateHmo: number;
  rateMedicaid: number;
  rateCommercial: number;
  ratePrivatePay: number;
  rateCharityIndigent: number;
  rateElmhs: number;

  // Utilization Breakdown (Revenue) - calculated from census × rates
  mcrFullDaysRev: number;
  mcrCoDaysRev: number;
  mcrLifetimeDaysRev: number;
  hmoRev: number;
  medicaidRev: number;
  commercialRev: number;
  privatePayRev: number;
  charityIndigentRev: number;
  elmhsRev: number;
  totalDeposits: number;

  // Daily Staffing Hours
  rnsHours: number;
  lpnsHours: number;
  mhtsHours: number;
  caseManagerHours: number;
  housekeepersHours: number;
  oneToOnesHours: number;
  agencyRnsHours: number;
  agencyLpnsHours: number;
  agencyMhtsHours: number;
  trainingNonProHours: number;
  ptoHours: number;

  // Position Per Day Cost
  rnsCost: number;
  lpnsCost: number;
  mhtsCost: number;
  caseManagerCost: number;
  housekeepersCost: number;
  oneToOnesCost: number;
  agencyRnsCost: number;
  agencyLpnsCost: number;
  agencyMhtsCost: number;
  trainingNonProCost: number;
  ptoCost: number;

  // Employee Risk
  employeesHired: number;
  employeesTermed: number;
  employeesOnPip: number;
  employmentClaims: number;
  totalPayroll: number;

  // Expenses
  offFormularyPharmacyPpd: number;
  labPpdOverage: number;
  dietaryOverBudget: number;
  suppliesOrdersPlaced: number;
  rtbhOutsideBudgetSubmitted: number;
  abnormalExpensesNotes: string;

  // Projected
  projectedDailyRevenue: number;
  projectedDailyExpense: number;
  dailyPop: number;
  projectedProfitLoss: number;
  mtdTrailingProfitLoss: number;

  // Quality Risk Events
  lateHp: number;
  lateInitialTreatmentPlans: number;
  latePsychEvals: number;
  lateDcSummaries: number;
  fallsWithInjury: number;
  fallsWithoutInjury: number;
  incidentReportWithInjury: number;
  incidentReportWithoutInjury: number;
  medicationVariance: number;
  hospitalTransfersReturned: number;
  hospitalTransfersNotReturned: number;
  restraints: number;
  seclusions: number;
  complaints: number;
  grievances: number;
  dcAgainstMedicalAdvice: number;
  safetyRounds: number;
  adminChartAudits: number;
  nursingChartAudits: number;
  clinicalChartAudits: number;
  qualityChartAudits: number;
  chartsRequested: number;
  appealsSent: number;
  racZpicAuditsOpen: number;
  mtpSignedByMd: number;
  internalDcSurveysExecuted: number;
  internalDcSurveysWhy: string;
  initialCert: number;
  recert: number;
  initialCertWhy: string;

  // IOP-specific fields
  iopDailyGroupsBilled: number;
  iopDailyAttendanceTotal: number;
  iopDailyMealsTotal: number;
  iopDailyEnrolledTotal: number;

  // Section Comments
  commentsCensus: string;
  commentsStaffing: string;
  commentsQualityRisk: string;
  commentsIop: string;
  commentsEmployeeRisk: string;
  commentsServiceDevelopment: string;
  lateQualityWhy: string;

  // Clean Census
  cleanCensus: number;
  cleanCensusVarianceWhy: string;

  // Deficiency Reports
  deficiencyReportsToDeptHead: boolean;
  deficiencyReportsWhy: string;
}

export const initialOperationsData: DailyOperationsData = {
  inquiries: 0, referrals: 0, redTerritoryAdmits: 0, blueTerritoryAdmits: 0, whiteTerritoryAdmits: 0,
  faceToFaceTouches: 0, qualityTouches: 0, inservices: 0, preScreenedBySdrs: 0, needsAnalysis: 0,
  top3Categories: '', discharges: 0, fiveStarSurveys: 0,
  mcrFullDays: 0, mcrCoDays: 0, mcrLifetimeDays: 0, hmoPtDays: 0, medicaidPtDays: 0,
  commercialPtDays: 0, privatePayPtDays: 0, charityIndigentPtDays: 0, elmhsPtDays: 0,
  rateMcrFullDays: 955, rateMcrCoDays: 536, rateMcrLifetimeDays: 117,
  rateHmo: 900, rateMedicaid: 737, rateCommercial: 800, ratePrivatePay: 800, rateCharityIndigent: 0, rateElmhs: 0,
  mcrFullDaysRev: 0, mcrCoDaysRev: 0, mcrLifetimeDaysRev: 0, hmoRev: 0, medicaidRev: 0,
  commercialRev: 0, privatePayRev: 0, charityIndigentRev: 0, elmhsRev: 0, totalDeposits: 0,
  rnsHours: 0, lpnsHours: 0, mhtsHours: 0, caseManagerHours: 0, housekeepersHours: 0,
  oneToOnesHours: 0, agencyRnsHours: 0, agencyLpnsHours: 0, agencyMhtsHours: 0,
  trainingNonProHours: 0, ptoHours: 0,
  rnsCost: 40, lpnsCost: 25, mhtsCost: 15, caseManagerCost: 14.5, housekeepersCost: 12.5,
  oneToOnesCost: 15, agencyRnsCost: 65, agencyLpnsCost: 45, agencyMhtsCost: 30,
  trainingNonProCost: 25.6, ptoCost: 25.6,
  employeesHired: 0, employeesTermed: 0, employeesOnPip: 0, employmentClaims: 0, totalPayroll: 0,
  offFormularyPharmacyPpd: 0, labPpdOverage: 0, dietaryOverBudget: 0, suppliesOrdersPlaced: 0,
  rtbhOutsideBudgetSubmitted: 0, abnormalExpensesNotes: '',
  projectedDailyRevenue: 0, projectedDailyExpense: 0, dailyPop: 0, projectedProfitLoss: 0, mtdTrailingProfitLoss: 0,
  lateHp: 0, lateInitialTreatmentPlans: 0, latePsychEvals: 0, lateDcSummaries: 0,
  fallsWithInjury: 0, fallsWithoutInjury: 0, incidentReportWithInjury: 0, incidentReportWithoutInjury: 0,
  medicationVariance: 0, hospitalTransfersReturned: 0, hospitalTransfersNotReturned: 0,
  restraints: 0, seclusions: 0, complaints: 0, grievances: 0, dcAgainstMedicalAdvice: 0,
  safetyRounds: 0, adminChartAudits: 0, nursingChartAudits: 0, clinicalChartAudits: 0,
  qualityChartAudits: 0, chartsRequested: 0, appealsSent: 0, racZpicAuditsOpen: 0,
  mtpSignedByMd: 0, internalDcSurveysExecuted: 0, internalDcSurveysWhy: '',
  initialCert: 0, recert: 0, initialCertWhy: '',
  iopDailyGroupsBilled: 0, iopDailyAttendanceTotal: 0, iopDailyMealsTotal: 0, iopDailyEnrolledTotal: 0,
  commentsCensus: '', commentsStaffing: '', commentsQualityRisk: '', commentsIop: '', commentsEmployeeRisk: '', commentsServiceDevelopment: '',
  lateQualityWhy: '',
  cleanCensus: 0, cleanCensusVarianceWhy: '',
  deficiencyReportsToDeptHead: true, deficiencyReportsWhy: '',
};

// Map camelCase to snake_case for database
const toDbRecord = (data: DailyOperationsData) => ({
  inquiries: data.inquiries,
  referrals: data.referrals,
  red_territory_admits: data.redTerritoryAdmits,
  blue_territory_admits: data.blueTerritoryAdmits,
  white_territory_admits: data.whiteTerritoryAdmits,
  face_to_face_touches: data.faceToFaceTouches,
  quality_touches: data.qualityTouches,
  inservices: data.inservices,
  pre_screened_by_sdrs: data.preScreenedBySdrs,
  needs_analysis: data.needsAnalysis,
  top_3_categories: data.top3Categories,
  discharges: data.discharges,
  five_star_surveys: data.fiveStarSurveys,
  mcr_full_days: data.mcrFullDays,
  mcr_co_days: data.mcrCoDays,
  mcr_lifetime_days: data.mcrLifetimeDays,
  hmo_pt_days: data.hmoPtDays,
  medicaid_pt_days: data.medicaidPtDays,
  commercial_pt_days: data.commercialPtDays,
  private_pay_pt_days: data.privatePayPtDays,
  charity_indigent_pt_days: data.charityIndigentPtDays,
  elmhs_pt_days: data.elmhsPtDays,
  rate_mcr_full_days: data.rateMcrFullDays,
  rate_mcr_co_days: data.rateMcrCoDays,
  rate_mcr_lifetime_days: data.rateMcrLifetimeDays,
  rate_hmo: data.rateHmo,
  rate_medicaid: data.rateMedicaid,
  rate_commercial: data.rateCommercial,
  rate_private_pay: data.ratePrivatePay,
  rate_charity_indigent: data.rateCharityIndigent,
  rate_elmhs: data.rateElmhs,
  mcr_full_days_rev: data.mcrFullDaysRev,
  mcr_co_days_rev: data.mcrCoDaysRev,
  mcr_lifetime_days_rev: data.mcrLifetimeDaysRev,
  hmo_rev: data.hmoRev,
  medicaid_rev: data.medicaidRev,
  commercial_rev: data.commercialRev,
  private_pay_rev: data.privatePayRev,
  charity_indigent_rev: data.charityIndigentRev,
  elmhs_rev: data.elmhsRev,
  total_deposits: data.totalDeposits,
  rns_hours: data.rnsHours,
  lpns_hours: data.lpnsHours,
  mhts_hours: data.mhtsHours,
  case_manager_hours: data.caseManagerHours,
  housekeepers_hours: data.housekeepersHours,
  one_to_ones_hours: data.oneToOnesHours,
  agency_rns_hours: data.agencyRnsHours,
  agency_lpns_hours: data.agencyLpnsHours,
  agency_mhts_hours: data.agencyMhtsHours,
  training_non_pro_hours: data.trainingNonProHours,
  pto_hours: data.ptoHours,
  rns_cost: data.rnsCost,
  lpns_cost: data.lpnsCost,
  mhts_cost: data.mhtsCost,
  case_manager_cost: data.caseManagerCost,
  housekeepers_cost: data.housekeepersCost,
  one_to_ones_cost: data.oneToOnesCost,
  agency_rns_cost: data.agencyRnsCost,
  agency_lpns_cost: data.agencyLpnsCost,
  agency_mhts_cost: data.agencyMhtsCost,
  training_non_pro_cost: data.trainingNonProCost,
  pto_cost: data.ptoCost,
  employees_hired: data.employeesHired,
  employees_termed: data.employeesTermed,
  employees_on_pip: data.employeesOnPip,
  employment_claims: data.employmentClaims,
  total_payroll: data.totalPayroll,
  off_formulary_pharmacy_ppd: data.offFormularyPharmacyPpd,
  lab_ppd_overage: data.labPpdOverage,
  dietary_over_budget: data.dietaryOverBudget,
  supplies_orders_placed: data.suppliesOrdersPlaced,
  rtbh_outside_budget_submitted: data.rtbhOutsideBudgetSubmitted,
  abnormal_expenses_notes: data.abnormalExpensesNotes,
  projected_daily_revenue: data.projectedDailyRevenue,
  projected_daily_expense: data.projectedDailyExpense,
  daily_pop: data.dailyPop,
  projected_profit_loss: data.projectedProfitLoss,
  mtd_trailing_profit_loss: data.mtdTrailingProfitLoss,
  late_hp: data.lateHp,
  late_initial_treatment_plans: data.lateInitialTreatmentPlans,
  late_psych_evals: data.latePsychEvals,
  late_dc_summaries: data.lateDcSummaries,
  falls_with_injury: data.fallsWithInjury,
  falls_without_injury: data.fallsWithoutInjury,
  incident_report_with_injury: data.incidentReportWithInjury,
  incident_report_without_injury: data.incidentReportWithoutInjury,
  medication_variance: data.medicationVariance,
  hospital_transfers_returned: data.hospitalTransfersReturned,
  hospital_transfers_not_returned: data.hospitalTransfersNotReturned,
  restraints: data.restraints,
  seclusions: data.seclusions,
  complaints: data.complaints,
  grievances: data.grievances,
  dc_against_medical_advice: data.dcAgainstMedicalAdvice,
  safety_rounds: data.safetyRounds,
  admin_chart_audits: data.adminChartAudits,
  nursing_chart_audits: data.nursingChartAudits,
  clinical_chart_audits: data.clinicalChartAudits,
  quality_chart_audits: data.qualityChartAudits,
  charts_requested: data.chartsRequested,
  appeals_sent: data.appealsSent,
  rac_zpic_audits_open: data.racZpicAuditsOpen,
  mtp_signed_by_md: data.mtpSignedByMd,
  internal_dc_surveys_executed: data.internalDcSurveysExecuted,
  internal_dc_surveys_why: data.internalDcSurveysWhy,
  initial_cert: data.initialCert,
  recert: data.recert,
  initial_cert_why: data.initialCertWhy,
  iop_daily_groups_billed: data.iopDailyGroupsBilled,
  iop_daily_attendance_total: data.iopDailyAttendanceTotal,
  iop_daily_meals_total: data.iopDailyMealsTotal,
  iop_daily_enrolled_total: data.iopDailyEnrolledTotal,
  comments_census: data.commentsCensus,
  comments_staffing: data.commentsStaffing,
  comments_quality_risk: data.commentsQualityRisk,
  comments_iop: data.commentsIop,
  comments_employee_risk: data.commentsEmployeeRisk,
  comments_service_development: data.commentsServiceDevelopment,
  late_quality_why: data.lateQualityWhy,
  clean_census: data.cleanCensus,
  clean_census_variance_why: data.cleanCensusVarianceWhy,
  deficiency_reports_to_dept_head: data.deficiencyReportsToDeptHead,
  deficiency_reports_why: data.deficiencyReportsWhy,
});

// Map snake_case from database to camelCase
const fromDbRecord = (record: any): DailyOperationsData => ({
  inquiries: Number(record.inquiries) || 0,
  referrals: Number(record.referrals) || 0,
  redTerritoryAdmits: Number(record.red_territory_admits) || 0,
  blueTerritoryAdmits: Number(record.blue_territory_admits) || 0,
  whiteTerritoryAdmits: Number(record.white_territory_admits) || 0,
  faceToFaceTouches: Number(record.face_to_face_touches) || 0,
  qualityTouches: Number(record.quality_touches) || 0,
  inservices: Number(record.inservices) || 0,
  preScreenedBySdrs: Number(record.pre_screened_by_sdrs) || 0,
  needsAnalysis: Number(record.needs_analysis) || 0,
  top3Categories: record.top_3_categories || '',
  discharges: Number(record.discharges) || 0,
  fiveStarSurveys: Number(record.five_star_surveys) || 0,
  mcrFullDays: Number(record.mcr_full_days) || 0,
  mcrCoDays: Number(record.mcr_co_days) || 0,
  mcrLifetimeDays: Number(record.mcr_lifetime_days) || 0,
  hmoPtDays: Number(record.hmo_pt_days) || 0,
  medicaidPtDays: Number(record.medicaid_pt_days) || 0,
  commercialPtDays: Number(record.commercial_pt_days) || 0,
  privatePayPtDays: Number(record.private_pay_pt_days) || 0,
  charityIndigentPtDays: Number(record.charity_indigent_pt_days) || 0,
  elmhsPtDays: Number(record.elmhs_pt_days) || 0,
  rateMcrFullDays: Number(record.rate_mcr_full_days) || 955,
  rateMcrCoDays: Number(record.rate_mcr_co_days) || 536,
  rateMcrLifetimeDays: Number(record.rate_mcr_lifetime_days) || 117,
  rateHmo: Number(record.rate_hmo) || 900,
  rateMedicaid: Number(record.rate_medicaid) || 737,
  rateCommercial: Number(record.rate_commercial) || 800,
  ratePrivatePay: Number(record.rate_private_pay) || 800,
  rateCharityIndigent: Number(record.rate_charity_indigent) || 0,
  rateElmhs: Number(record.rate_elmhs) || 0,
  mcrFullDaysRev: Number(record.mcr_full_days_rev) || 0,
  mcrCoDaysRev: Number(record.mcr_co_days_rev) || 0,
  mcrLifetimeDaysRev: Number(record.mcr_lifetime_days_rev) || 0,
  hmoRev: Number(record.hmo_rev) || 0,
  medicaidRev: Number(record.medicaid_rev) || 0,
  commercialRev: Number(record.commercial_rev) || 0,
  privatePayRev: Number(record.private_pay_rev) || 0,
  charityIndigentRev: Number(record.charity_indigent_rev) || 0,
  elmhsRev: Number(record.elmhs_rev) || 0,
  totalDeposits: Number(record.total_deposits) || 0,
  rnsHours: Number(record.rns_hours) || 0,
  lpnsHours: Number(record.lpns_hours) || 0,
  mhtsHours: Number(record.mhts_hours) || 0,
  caseManagerHours: Number(record.case_manager_hours) || 0,
  housekeepersHours: Number(record.housekeepers_hours) || 0,
  oneToOnesHours: Number(record.one_to_ones_hours) || 0,
  agencyRnsHours: Number(record.agency_rns_hours) || 0,
  agencyLpnsHours: Number(record.agency_lpns_hours) || 0,
  agencyMhtsHours: Number(record.agency_mhts_hours) || 0,
  trainingNonProHours: Number(record.training_non_pro_hours) || 0,
  ptoHours: Number(record.pto_hours) || 0,
  rnsCost: Number(record.rns_cost) || 40,
  lpnsCost: Number(record.lpns_cost) || 25,
  mhtsCost: Number(record.mhts_cost) || 15,
  caseManagerCost: Number(record.case_manager_cost) || 14.5,
  housekeepersCost: Number(record.housekeepers_cost) || 12.5,
  oneToOnesCost: Number(record.one_to_ones_cost) || 15,
  agencyRnsCost: Number(record.agency_rns_cost) || 65,
  agencyLpnsCost: Number(record.agency_lpns_cost) || 45,
  agencyMhtsCost: Number(record.agency_mhts_cost) || 30,
  trainingNonProCost: Number(record.training_non_pro_cost) || 25.6,
  ptoCost: Number(record.pto_cost) || 25.6,
  employeesHired: Number(record.employees_hired) || 0,
  employeesTermed: Number(record.employees_termed) || 0,
  employeesOnPip: Number(record.employees_on_pip) || 0,
  employmentClaims: Number(record.employment_claims) || 0,
  totalPayroll: Number(record.total_payroll) || 0,
  offFormularyPharmacyPpd: Number(record.off_formulary_pharmacy_ppd) || 0,
  labPpdOverage: Number(record.lab_ppd_overage) || 0,
  dietaryOverBudget: Number(record.dietary_over_budget) || 0,
  suppliesOrdersPlaced: Number(record.supplies_orders_placed) || 0,
  rtbhOutsideBudgetSubmitted: Number(record.rtbh_outside_budget_submitted) || 0,
  abnormalExpensesNotes: record.abnormal_expenses_notes || '',
  projectedDailyRevenue: Number(record.projected_daily_revenue) || 0,
  projectedDailyExpense: Number(record.projected_daily_expense) || 0,
  dailyPop: Number(record.daily_pop) || 0,
  projectedProfitLoss: Number(record.projected_profit_loss) || 0,
  mtdTrailingProfitLoss: Number(record.mtd_trailing_profit_loss) || 0,
  lateHp: Number(record.late_hp) || 0,
  lateInitialTreatmentPlans: Number(record.late_initial_treatment_plans) || 0,
  latePsychEvals: Number(record.late_psych_evals) || 0,
  lateDcSummaries: Number(record.late_dc_summaries) || 0,
  fallsWithInjury: Number(record.falls_with_injury) || 0,
  fallsWithoutInjury: Number(record.falls_without_injury) || 0,
  incidentReportWithInjury: Number(record.incident_report_with_injury) || 0,
  incidentReportWithoutInjury: Number(record.incident_report_without_injury) || 0,
  medicationVariance: Number(record.medication_variance) || 0,
  hospitalTransfersReturned: Number(record.hospital_transfers_returned) || 0,
  hospitalTransfersNotReturned: Number(record.hospital_transfers_not_returned) || 0,
  restraints: Number(record.restraints) || 0,
  seclusions: Number(record.seclusions) || 0,
  complaints: Number(record.complaints) || 0,
  grievances: Number(record.grievances) || 0,
  dcAgainstMedicalAdvice: Number(record.dc_against_medical_advice) || 0,
  safetyRounds: Number(record.safety_rounds) || 0,
  adminChartAudits: Number(record.admin_chart_audits) || 0,
  nursingChartAudits: Number(record.nursing_chart_audits) || 0,
  clinicalChartAudits: Number(record.clinical_chart_audits) || 0,
  qualityChartAudits: Number(record.quality_chart_audits) || 0,
  chartsRequested: Number(record.charts_requested) || 0,
  appealsSent: Number(record.appeals_sent) || 0,
  racZpicAuditsOpen: Number(record.rac_zpic_audits_open) || 0,
  mtpSignedByMd: Number(record.mtp_signed_by_md) || 0,
  internalDcSurveysExecuted: Number(record.internal_dc_surveys_executed) || 0,
  internalDcSurveysWhy: record.internal_dc_surveys_why || '',
  initialCert: Number(record.initial_cert) || 0,
  recert: Number(record.recert) || 0,
  initialCertWhy: record.initial_cert_why || '',
  iopDailyGroupsBilled: Number(record.iop_daily_groups_billed) || 0,
  iopDailyAttendanceTotal: Number(record.iop_daily_attendance_total) || 0,
  iopDailyMealsTotal: Number(record.iop_daily_meals_total) || 0,
  iopDailyEnrolledTotal: Number(record.iop_daily_enrolled_total) || 0,
  commentsCensus: record.comments_census || '',
  commentsStaffing: record.comments_staffing || '',
  commentsQualityRisk: record.comments_quality_risk || '',
  commentsIop: record.comments_iop || '',
  commentsEmployeeRisk: record.comments_employee_risk || '',
  commentsServiceDevelopment: record.comments_service_development || '',
  lateQualityWhy: record.late_quality_why || '',
  cleanCensus: Number(record.clean_census) || 0,
  cleanCensusVarianceWhy: record.clean_census_variance_why || '',
  deficiencyReportsToDeptHead: record.deficiency_reports_to_dept_head !== false,
  deficiencyReportsWhy: record.deficiency_reports_why || '',
});

export function useDailyOperations(facilityId: string | null, unitId: string | null, date: Date) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const [data, setData] = useState<DailyOperationsData>(initialOperationsData);
  const [existingId, setExistingId] = useState<string | null>(null);

  const dateStr = format(date, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');

  // Fetch existing entry for the selected date and unit
  const { data: existingEntry, isLoading } = useQuery({
    queryKey: ['daily-operations', unitId, dateStr],
    queryFn: async () => {
      if (!unitId) return null;
      const { data, error } = await supabase
        .from('daily_operations')
        .select('*')
        .eq('unit_id', unitId)
        .eq('date', dateStr)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!unitId,
  });

  // Load existing data into state when fetched
  useEffect(() => {
    if (existingEntry) {
      setData(fromDbRecord(existingEntry));
      setExistingId(existingEntry.id);
    } else {
      setData(initialOperationsData);
      setExistingId(null);
    }
  }, [existingEntry]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ status }: { status: 'draft' | 'submitted' }) => {
      if (!facilityId || !unitId || !user) throw new Error('Missing facility, unit, or user');
      
      const dbData: Record<string, any> = {
        ...toDbRecord(data),
        facility_id: facilityId,
        unit_id: unitId,
        date: dateStr,
        submitted_by: user.id,
        status,
      };

      // Set initial_submitted_at only on first submission
      if (status === 'submitted' && (!existingEntry || !existingEntry.initial_submitted_at)) {
        dbData.initial_submitted_at = new Date().toISOString();
      }

      // Use upsert to prevent duplicate key errors from race conditions
      const { error } = await supabase
        .from('daily_operations')
        .upsert(dbData as any, { onConflict: 'unit_id,date' })
        .select('id')
        .single();
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['daily-operations', unitId, dateStr] });
      queryClient.invalidateQueries({ queryKey: ['program-rankings'] });
      logActivity({
        action: 'save_daily_operations',
        resourceType: 'daily_operations',
        resourceId: unitId || undefined,
        details: { date: dateStr, status, facility_id: facilityId } as any,
      });
      toast({
        title: status === 'submitted' ? 'Entry Submitted' : 'Draft Saved',
        description: `Daily operations for ${format(date, 'MMM d, yyyy')} saved successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error saving entry',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Copy yesterday mutation
  const copyYesterdayMutation = useMutation({
    mutationFn: async () => {
      if (!unitId) throw new Error('No unit selected');
      
      const { data: yesterdayData, error } = await supabase
        .from('daily_operations')
        .select('*')
        .eq('unit_id', unitId)
        .eq('date', yesterdayStr)
        .maybeSingle();

      if (error) throw error;
      if (!yesterdayData) throw new Error('No entry found for yesterday');

      return fromDbRecord(yesterdayData);
    },
    onSuccess: (yesterdayData) => {
      setData(yesterdayData);
      toast({
        title: 'Data Copied',
        description: `Copied data from ${format(subDays(date, 1), 'MMM d, yyyy')}. Remember to save!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Could not copy yesterday\'s data',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateField = <K extends keyof DailyOperationsData>(field: K, value: DailyOperationsData[K]) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return {
    data,
    updateField,
    isLoading,
    isSaving: saveMutation.isPending,
    isCopying: copyYesterdayMutation.isPending,
    save: (status: 'draft' | 'submitted') => saveMutation.mutate({ status }),
    copyYesterday: () => copyYesterdayMutation.mutate(),
    hasExistingEntry: !!existingId,
  };
}
