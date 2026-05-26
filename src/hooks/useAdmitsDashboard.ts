import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, getDaysInMonth } from 'date-fns';

export interface Facility {
  id: string;
  name: string;
  code: string;
}

export interface Unit {
  id: string;
  name: string;
  unit_type: string;
}

export interface AdmitsData {
  budgetAdmits: number;
  actualAdmits: number;
  variancePercent: number;
  performanceGrade: string;
}

export interface DashboardMetrics {
  totalReferrals: number;
  totalDischarges: number;
  avgDailyCensus: number;
}

export interface ChartDataPoint {
  date: string;
  budget: number;
  actual: number;
}

export function useAdmitsDashboard(
  startDate: Date,
  endDate: Date,
  facilityId: string | null = null,
  unitId: string | null = null
) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [budgetAdmits, setBudgetAdmits] = useState<number>(0);
  const [actualAdmits, setActualAdmits] = useState<number>(0);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [totalReferrals, setTotalReferrals] = useState<number>(0);
  const [totalDischarges, setTotalDischarges] = useState<number>(0);
  const [avgDailyCensus, setAvgDailyCensus] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Load facilities
  useEffect(() => {
    async function loadFacilities() {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setFacilities(data);
      }
    }
    loadFacilities();
  }, []);

  // Load available units for selected facility (same as Operations Summary)
  useEffect(() => {
    async function loadUnits() {
      if (!facilityId) {
        setAvailableUnits([]);
        return;
      }

      const { data, error } = await supabase
        .from('units')
        .select('id, name, unit_type')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('name');

      if (!error && data) {
        setAvailableUnits(data);
      }
    }
    loadUnits();
  }, [facilityId]);

  // Load admits data
  useEffect(() => {
    async function loadData() {
      if (!facilityId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      const startMonth = startDate.getMonth() + 1;
      const endMonth = endDate.getMonth() + 1;

      // Get budget year(s)
      const years = [...new Set([startYear, endYear])];
      const { data: yearData } = await supabase
        .from('budget_years')
        .select('id, year')
        .in('year', years);

      if (!yearData || yearData.length === 0) {
        setBudgetAdmits(0);
        setActualAdmits(0);
        setLoading(false);
        return;
      }

      // Find "admits" and "other_admits" rows (Total Admits = SUM(admits, other_admits))
      const { data: admitRows } = await supabase
        .from('budget_rows')
        .select('id, row_key')
        .in('row_key', ['admits', 'other_admits']);

      let budgetTotal = 0;

      if (admitRows && admitRows.length > 0) {
        const admitRowIds = admitRows.map(r => r.id);
        
        // Get unit IDs - either specific unit or all INPATIENT units for facility (ADULT/GERI)
        let unitIds: string[] = [];
        
        if (unitId) {
          // Specific unit selected
          unitIds = [unitId];
        } else {
          // All INPATIENT units (ADULT/GERI) for this facility
          const { data: unitsData } = await supabase
            .from('units')
            .select('id')
            .eq('facility_id', facilityId)
            .eq('is_active', true)
            .eq('unit_type', 'INPATIENT');
          unitIds = (unitsData || []).map(u => u.id);
        }

        if (unitIds.length > 0) {
          // Get budget values for the date range
          for (const yearInfo of yearData) {
            const { data: budgets } = await supabase
              .from('budgets')
              .select('month, value')
              .eq('budget_year_id', yearInfo.id)
              .in('row_id', admitRowIds)
              .in('unit_id', unitIds);

            if (budgets) {
              budgets.forEach((b) => {
                // Check if this month is within our date range
                const monthInYear = b.month;
                const yearForMonth = yearInfo.year;
                const monthDate = new Date(yearForMonth, monthInYear - 1, 1);
                
                if (monthDate >= new Date(startYear, startMonth - 1, 1) && 
                    monthDate <= new Date(endYear, endMonth - 1, 28)) {
                  budgetTotal += Number(b.value) || 0;
                }
              });
            }
          }
        }
      }

      // Get actual admits from service_development_entries (same source as Operations Summary)
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      // Get unit IDs - either specific unit or all units for facility
      let unitIdsForOps: string[] = [];
      
      if (unitId) {
        // Specific unit selected
        unitIdsForOps = [unitId];
      } else {
        // All units for this facility
        const { data: unitsForOps } = await supabase
          .from('units')
          .select('id')
          .eq('facility_id', facilityId)
          .eq('is_active', true);
        unitIdsForOps = (unitsForOps || []).map(u => u.id);
      }

      let actualTotal = 0;
      let referralsTotal = 0;
      let dischargesTotal = 0;

      if (unitIdsForOps.length > 0) {
        // Fetch all service development entries (admits, referrals, discharges) with date
        const { data: serviceDevData } = await supabase
          .from('service_development_entries')
          .select('numeric_value, metric_name, date')
          .eq('facility_id', facilityId)
          .in('metric_name', ['admits', 'referrals', 'discharges'])
          .gte('date', startStr)
          .lte('date', endStr)
          .in('unit_id', unitIdsForOps);
        
        // Build daily admits map for chart
        const dailyAdmitsMap: Record<string, number> = {};
        
        // Sum up values by metric
        (serviceDevData || []).forEach((entry) => {
          const value = Number(entry.numeric_value || 0);
          if (entry.metric_name === 'admits') {
            actualTotal += value;
            // Aggregate by date for chart
            const dateKey = entry.date;
            dailyAdmitsMap[dateKey] = (dailyAdmitsMap[dateKey] || 0) + value;
          } else if (entry.metric_name === 'referrals') {
            referralsTotal += value;
          } else if (entry.metric_name === 'discharges') {
            dischargesTotal += value;
          }
        });

        // Build chart data - aggregate by day
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const daysInRange = days.length;
        
        // Calculate daily budget (total budget / days in range)
        const dailyBudget = daysInRange > 0 ? budgetTotal / daysInRange : 0;
        
        const chartPoints: ChartDataPoint[] = days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          return {
            date: format(day, 'MMM d'),
            budget: Math.round(dailyBudget * 10) / 10,
            actual: dailyAdmitsMap[dateStr] || 0,
          };
        });
        
        setChartData(chartPoints);

        // Fetch daily operations for census calculation (same as Operations Summary)
        let dailyOpsQuery = supabase
          .from('daily_operations')
          .select('mcr_full_days, mcr_co_days, mcr_lifetime_days, hmo_pt_days, medicaid_pt_days, commercial_pt_days, private_pay_pt_days, charity_indigent_pt_days')
          .eq('facility_id', facilityId)
          .gte('date', startStr)
          .lte('date', endStr)
          .in('unit_id', unitIdsForOps);

        const { data: dailyOpsData } = await dailyOpsQuery;

        // Calculate average daily census
        let totalCensus = 0;
        const daysCount = (dailyOpsData || []).length;
        
        (dailyOpsData || []).forEach((day) => {
          totalCensus += Number(day.mcr_full_days || 0);
          totalCensus += Number(day.mcr_co_days || 0);
          totalCensus += Number(day.mcr_lifetime_days || 0);
          totalCensus += Number(day.hmo_pt_days || 0);
          totalCensus += Number(day.medicaid_pt_days || 0);
          totalCensus += Number(day.commercial_pt_days || 0);
          totalCensus += Number(day.private_pay_pt_days || 0);
          totalCensus += Number(day.charity_indigent_pt_days || 0);
        });

        // Add IOP census from iop_patients (source of truth for IOP units)
        const { data: iopPatientsData } = await supabase
          .from('iop_patients')
          .select('entry_date')
          .eq('facility_id', facilityId)
          .gte('entry_date', startStr)
          .lte('entry_date', endStr)
          .in('unit_id', unitIdsForOps);

        const iopDates = new Set<string>();
        (iopPatientsData || []).forEach((p: any) => {
          totalCensus += 1;
          if (p.entry_date) iopDates.add(p.entry_date);
        });

        const censusDayBasis = Math.max(daysCount, iopDates.size);
        const avgCensus = censusDayBasis > 0 ? totalCensus / censusDayBasis : 0;
        setAvgDailyCensus(avgCensus);
      }

      setBudgetAdmits(budgetTotal);
      setActualAdmits(actualTotal);
      setTotalReferrals(referralsTotal);
      setTotalDischarges(dischargesTotal);
      setLoading(false);
    }

    loadData();
  }, [startDate, endDate, facilityId, unitId]);

  // Calculate variance and grade
  const admitsData = useMemo((): AdmitsData => {
    const variancePercent = budgetAdmits !== 0 
      ? (actualAdmits / budgetAdmits) * 100 
      : 0;

    let performanceGrade = 'N/A';
    if (budgetAdmits > 0) {
      if (variancePercent >= 91) {
        performanceGrade = 'A';
      } else if (variancePercent >= 81) {
        performanceGrade = 'B';
      } else if (variancePercent >= 71) {
        performanceGrade = 'C';
      } else if (variancePercent >= 61) {
        performanceGrade = 'D';
      } else {
        performanceGrade = 'F';
      }
    }

    return {
      budgetAdmits,
      actualAdmits,
      variancePercent,
      performanceGrade,
    };
  }, [budgetAdmits, actualAdmits]);

  // Additional metrics
  const metrics = useMemo((): DashboardMetrics => ({
    totalReferrals,
    totalDischarges,
    avgDailyCensus,
  }), [totalReferrals, totalDischarges, avgDailyCensus]);

  return {
    facilities,
    availableUnits,
    admitsData,
    metrics,
    chartData,
    loading,
  };
}
