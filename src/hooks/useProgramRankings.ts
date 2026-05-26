import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  isWeekend,
  previousFriday,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useFacilityAccess } from '@/hooks/useFacilityAccess';

type ProgramType = 'INPATIENT' | 'IOP';

type FacilityRecord = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

type UnitRecord = {
  id: string;
  name: string;
  facility_id: string;
  unit_type: string;
  is_active: boolean;
};

type ProgramRankingDailyActualRecord = {
  facility_id: string;
  unit_id: string;
  date: string;
  actual_value: number | null;
};

type DailyOperationsActualRecord = {
  facility_id: string;
  unit_id: string;
  iop_daily_enrolled_total: number | null;
  mcr_full_days: number | null;
  mcr_co_days: number | null;
  mcr_lifetime_days: number | null;
  hmo_pt_days: number | null;
  medicaid_pt_days: number | null;
  commercial_pt_days: number | null;
  private_pay_pt_days: number | null;
  charity_indigent_pt_days: number | null;
};

type BudgetRowRecord = {
  id: string;
  row_key: string;
};

type BudgetRecord = {
  unit_id: string;
  row_id: string;
  month: number;
  value: number | null;
};

export interface RankingMetricSet {
  budget: number;
  actual: number;
  variance: number;
}

export interface ProgramRankingRow {
  rank: number;
  facilityId: string;
  facilityName: string;
  unitId: string;
  unitName: string;
  daily: RankingMetricSet;
  mtd: RankingMetricSet;
  ytd: RankingMetricSet;
}

interface ProgramRankingsResult {
  asOfDate: Date;
  inpatientRankings: ProgramRankingRow[];
  iopRankings: ProgramRankingRow[];
  facilities: FacilityRecord[];
}

const BUDGET_ROW_KEYS = [
  'pt_days',
  'days_in_month',
  'other_patient_days',
  'adc',
  'other_adc',
  'total_adc',
  'iop_total_visits',
  'iop_weekdays',
  'iop_ada',
] as const;

function getBusinessDate(input?: Date) {
  const base = input ?? new Date();
  return isWeekend(base) ? previousFriday(base) : base;
}

function numberOrZero(value: number | null | undefined) {
  return Number(value || 0);
}

function getDateKey(value: string) {
  return value.slice(0, 10);
}

function calculateDailyActualFromSnapshots(rows: ProgramRankingDailyActualRecord[]) {
  if (rows.length === 0) return 0;

  return rows.reduce((total, row) => total + numberOrZero(row.actual_value), 0);
}

function calculateAverageDailyActualFromSnapshots(rows: ProgramRankingDailyActualRecord[]) {
  if (rows.length === 0) return 0;

  const totalsByDate = new Map<string, number>();

  for (const row of rows) {
    totalsByDate.set(row.date, (totalsByDate.get(row.date) || 0) + numberOrZero(row.actual_value));
  }

  if (totalsByDate.size === 0) return 0;

  const total = Array.from(totalsByDate.values()).reduce((sum, value) => sum + value, 0);
  return total / totalsByDate.size;
}

function calculateDailyOperationsActual(row: DailyOperationsActualRecord, unitType: string) {
  if (unitType === 'IOP') {
    return numberOrZero(row.iop_daily_enrolled_total);
  }

  return (
    numberOrZero(row.mcr_full_days)
    + numberOrZero(row.mcr_co_days)
    + numberOrZero(row.mcr_lifetime_days)
    + numberOrZero(row.hmo_pt_days)
    + numberOrZero(row.medicaid_pt_days)
    + numberOrZero(row.commercial_pt_days)
    + numberOrZero(row.private_pay_pt_days)
    + numberOrZero(row.charity_indigent_pt_days)
  );
}

function createMetricSet(budget: number, actual: number): RankingMetricSet {
  return {
    budget,
    actual,
    variance: actual - budget,
  };
}

function getApplicableDaysForMonth(year: number, month: number, asOfDate: Date) {
  const asOfMonth = asOfDate.getMonth() + 1;
  if (month > asOfMonth) return 0;
  if (month < asOfMonth) return getDaysInMonth(new Date(year, month - 1, 1));
  return differenceInCalendarDays(asOfDate, startOfMonth(asOfDate)) + 1;
}

function calculateYtdBudget(monthlyBudgetMap: Map<number, number>, asOfDate: Date) {
  const year = asOfDate.getFullYear();
  let weightedTotal = 0;
  let totalDays = 0;

  for (let month = 1; month <= asOfDate.getMonth() + 1; month += 1) {
    const applicableDays = getApplicableDaysForMonth(year, month, asOfDate);
    if (applicableDays === 0) continue;

    weightedTotal += (monthlyBudgetMap.get(month) || 0) * applicableDays;
    totalDays += applicableDays;
  }

  return totalDays > 0 ? weightedTotal / totalDays : 0;
}

function safeDivide(numerator?: number, denominator?: number) {
  if (numerator === undefined || denominator === undefined || denominator === 0) return undefined;
  return numerator / denominator;
}

function buildBudgetValueContext(
  budgets: BudgetRecord[],
  budgetRowsById: Map<string, string>,
) {
  const lookup = new Map<string, Map<string, Map<number, number>>>();

  for (const budget of budgets) {
    const rowKey = budgetRowsById.get(budget.row_id);
    if (!rowKey) continue;

    const unitLookup = lookup.get(budget.unit_id) || new Map<string, Map<number, number>>();
    const monthlyMap = unitLookup.get(rowKey) || new Map<number, number>();

    monthlyMap.set(budget.month, numberOrZero(budget.value));
    unitLookup.set(rowKey, monthlyMap);
    lookup.set(budget.unit_id, unitLookup);
  }

  return lookup;
}

function getBudgetValue(
  budgetContext: Map<string, Map<string, Map<number, number>>>,
  unitId: string,
  rowKey: string,
  month: number,
) {
  return budgetContext.get(unitId)?.get(rowKey)?.get(month);
}

function deriveInpatientMonthlyBudget(
  budgetContext: Map<string, Map<string, Map<number, number>>>,
  unitId: string,
  month: number,
) {
  const storedTotalAdc = getBudgetValue(budgetContext, unitId, 'total_adc', month);
  if (storedTotalAdc !== undefined) return storedTotalAdc;

  const storedAdc = getBudgetValue(budgetContext, unitId, 'adc', month);
  const storedOtherAdc = getBudgetValue(budgetContext, unitId, 'other_adc', month);
  if (storedAdc !== undefined || storedOtherAdc !== undefined) {
    return (storedAdc || 0) + (storedOtherAdc || 0);
  }

  const daysInMonth = getBudgetValue(budgetContext, unitId, 'days_in_month', month);
  const adc = safeDivide(getBudgetValue(budgetContext, unitId, 'pt_days', month), daysInMonth);
  const otherAdc = safeDivide(getBudgetValue(budgetContext, unitId, 'other_patient_days', month), daysInMonth);

  if (adc !== undefined || otherAdc !== undefined) {
    return (adc || 0) + (otherAdc || 0);
  }

  return 0;
}

function deriveIopMonthlyBudget(
  budgetContext: Map<string, Map<string, Map<number, number>>>,
  unitId: string,
  month: number,
) {
  const storedAda = getBudgetValue(budgetContext, unitId, 'iop_ada', month);
  if (storedAda !== undefined) return storedAda;

  return safeDivide(
    getBudgetValue(budgetContext, unitId, 'iop_total_visits', month),
    getBudgetValue(budgetContext, unitId, 'iop_weekdays', month),
  ) || 0;
}

function buildDerivedBudgetLookup(
  unitIds: string[],
  budgetContext: Map<string, Map<string, Map<number, number>>>,
  deriveMonthlyBudget: (budgetContext: Map<string, Map<string, Map<number, number>>>, unitId: string, month: number) => number,
) {
  const lookup = new Map<string, Map<number, number>>();

  for (const unitId of unitIds) {
    const monthlyMap = new Map<number, number>();

    for (let month = 1; month <= 12; month += 1) {
      monthlyMap.set(month, deriveMonthlyBudget(budgetContext, unitId, month));
    }

    lookup.set(unitId, monthlyMap);
  }

  return lookup;
}

export function useProgramRankings(referenceDate?: Date) {
  const { filterFacilities, assignedFacilityIds, shouldViewAll } = useFacilityAccess();
  const asOfDate = useMemo(() => getBusinessDate(referenceDate), [referenceDate]);

  const query = useQuery({
    queryKey: ['program-rankings', format(asOfDate, 'yyyy-MM-dd'), shouldViewAll, assignedFacilityIds.join(',')],
    queryFn: async (): Promise<ProgramRankingsResult> => {
      const ytdStart = format(startOfYear(asOfDate), 'yyyy-MM-dd');
      const asOfDateString = format(asOfDate, 'yyyy-MM-dd');

      const [facilitiesResult, unitsResult, budgetRowsResult, budgetYearResult, actualSnapshotsResult, selectedDayDailyOpsResult] = await Promise.all([
        supabase.from('facilities').select('id, name, code, is_active').eq('is_active', true).order('name'),
        supabase.from('units').select('id, name, facility_id, unit_type, is_active').eq('is_active', true),
        supabase.from('budget_rows').select('id, row_key').in('row_key', [...BUDGET_ROW_KEYS]),
        supabase.from('budget_years').select('id').eq('year', asOfDate.getFullYear()).maybeSingle(),
        supabase
          .from('program_ranking_daily_actuals')
          .select('facility_id, unit_id, date, actual_value')
          .gte('date', ytdStart)
          .lte('date', asOfDateString),
        supabase
          .from('daily_operations')
          .select('facility_id, unit_id, iop_daily_enrolled_total, mcr_full_days, mcr_co_days, mcr_lifetime_days, hmo_pt_days, medicaid_pt_days, commercial_pt_days, private_pay_pt_days, charity_indigent_pt_days')
          .eq('date', asOfDateString),
      ]);

      if (facilitiesResult.error) throw facilitiesResult.error;
      if (unitsResult.error) throw unitsResult.error;
      if (budgetRowsResult.error) throw budgetRowsResult.error;
      if (actualSnapshotsResult.error) throw actualSnapshotsResult.error;
      if (selectedDayDailyOpsResult.error) throw selectedDayDailyOpsResult.error;
      if (budgetYearResult.error) throw budgetYearResult.error;

      const accessibleFacilities = filterFacilities((facilitiesResult.data || []) as FacilityRecord[]);
      const facilitiesById = new Map(accessibleFacilities.map((facility) => [facility.id, facility]));
      const accessibleFacilityIds = new Set(accessibleFacilities.map((facility) => facility.id));

      const accessibleUnits = ((unitsResult.data || []) as UnitRecord[]).filter((unit) => accessibleFacilityIds.has(unit.facility_id));
      const unitsById = new Map(accessibleUnits.map((unit) => [unit.id, unit]));
      const inpatientUnits = accessibleUnits.filter((unit) => unit.unit_type === 'INPATIENT');
      const iopUnits = accessibleUnits.filter((unit) => unit.unit_type === 'IOP');
      const inpatientUnitIds = new Set(inpatientUnits.map((unit) => unit.id));
      const iopUnitIds = new Set(iopUnits.map((unit) => unit.id));

      const budgetRowsById = new Map(((budgetRowsResult.data || []) as BudgetRowRecord[]).map((row) => [row.id, row.row_key]));

      let budgets: BudgetRecord[] = [];
      if (budgetYearResult.data) {
        const budgetUnitIds = accessibleUnits.map((unit) => unit.id);
        if (budgetUnitIds.length > 0) {
          const budgetsResult = await supabase
            .from('budgets')
            .select('unit_id, row_id, month, value')
            .eq('budget_year_id', budgetYearResult.data.id)
            .in('unit_id', budgetUnitIds)
            .in('row_id', Array.from(budgetRowsById.keys()));

          if (budgetsResult.error) throw budgetsResult.error;
          budgets = (budgetsResult.data || []) as BudgetRecord[];
        }
      }

      const budgetContext = buildBudgetValueContext(budgets, budgetRowsById);

      const inpatientBudgetLookup = buildDerivedBudgetLookup(
        inpatientUnits.map((unit) => unit.id),
        budgetContext,
        deriveInpatientMonthlyBudget,
      );

      const iopBudgetLookup = buildDerivedBudgetLookup(
        iopUnits.map((unit) => unit.id),
        budgetContext,
        deriveIopMonthlyBudget,
      );

      const actualSnapshots = ((actualSnapshotsResult.data || []) as ProgramRankingDailyActualRecord[]).filter(
        (row) => accessibleFacilityIds.has(row.facility_id) && unitsById.has(row.unit_id),
      );

      const mtdStart = format(startOfMonth(asOfDate), 'yyyy-MM-dd');
      const ytdRows = actualSnapshots;
      const mtdRows = actualSnapshots.filter((row) => getDateKey(row.date) >= mtdStart);
      const dailyRows = actualSnapshots.filter((row) => getDateKey(row.date) === asOfDateString);
      const selectedDayFallbackActuals = new Map<string, number>(
        ((selectedDayDailyOpsResult.data || []) as DailyOperationsActualRecord[])
          .filter((row) => accessibleFacilityIds.has(row.facility_id) && unitsById.has(row.unit_id))
          .map((row) => {
            const unitType = unitsById.get(row.unit_id)?.unit_type || 'INPATIENT';
            return [row.unit_id, calculateDailyOperationsActual(row, unitType)];
          }),
      );
      const currentMonth = asOfDate.getMonth() + 1;

      const buildRankings = (programType: ProgramType) => {
        const relevantUnits = programType === 'INPATIENT' ? inpatientUnits : iopUnits;
        const relevantUnitIds = programType === 'INPATIENT' ? inpatientUnitIds : iopUnitIds;
        const budgetLookup = programType === 'INPATIENT' ? inpatientBudgetLookup : iopBudgetLookup;

        const rowsForProgram = {
          daily: dailyRows.filter((row) => relevantUnitIds.has(row.unit_id)),
          mtd: mtdRows.filter((row) => relevantUnitIds.has(row.unit_id)),
          ytd: ytdRows.filter((row) => relevantUnitIds.has(row.unit_id)),
        };

        return relevantUnits
          .map((unit) => {
            const facility = facilitiesById.get(unit.facility_id);
            if (!facility) return null;

            const monthlyBudgetMap = budgetLookup.get(unit.id) || new Map<number, number>();
            const unitDailyRows = rowsForProgram.daily.filter((row) => row.unit_id === unit.id);
            const unitMtdRows = rowsForProgram.mtd.filter((row) => row.unit_id === unit.id);
            const unitYtdRows = rowsForProgram.ytd.filter((row) => row.unit_id === unit.id);
            const snapshotDailyActual = calculateDailyActualFromSnapshots(unitDailyRows);
            const dailyActual = unitDailyRows.length > 0 ? snapshotDailyActual : (selectedDayFallbackActuals.get(unit.id) || 0);
            const mtdActual = calculateAverageDailyActualFromSnapshots(unitMtdRows);
            const ytdActual = calculateAverageDailyActualFromSnapshots(unitYtdRows);
            const currentMonthBudget = monthlyBudgetMap.get(currentMonth) || 0;
            const ytdBudget = calculateYtdBudget(monthlyBudgetMap, asOfDate);

            return {
              rank: 0,
              facilityId: facility.id,
              facilityName: facility.name,
              unitId: unit.id,
              unitName: unit.name,
              daily: createMetricSet(currentMonthBudget, dailyActual),
              mtd: createMetricSet(currentMonthBudget, mtdActual),
              ytd: createMetricSet(ytdBudget, ytdActual),
            } satisfies ProgramRankingRow;
          })
          .filter((row): row is ProgramRankingRow => {
            if (!row) return false;

            return (
              row.daily.budget !== 0 ||
              row.daily.actual !== 0 ||
              row.mtd.actual !== 0 ||
              row.ytd.actual !== 0 ||
              row.ytd.budget !== 0
            );
          })
          .sort((a, b) => {
            if (b.daily.variance !== a.daily.variance) return b.daily.variance - a.daily.variance;
            if (b.ytd.variance !== a.ytd.variance) return b.ytd.variance - a.ytd.variance;
            if (b.mtd.variance !== a.mtd.variance) return b.mtd.variance - a.mtd.variance;
            if (a.facilityName !== b.facilityName) return a.facilityName.localeCompare(b.facilityName);
            return a.unitName.localeCompare(b.unitName);
          })
          .map((row, index) => ({ ...row, rank: index + 1 }));
      };

      return {
        asOfDate,
        facilities: accessibleFacilities,
        inpatientRankings: buildRankings('INPATIENT'),
        iopRankings: buildRankings('IOP'),
      };
    },
  });

  return {
    ...query,
    asOfDate,
  };
}