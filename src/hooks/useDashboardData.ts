import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { evaluateFormula, type FormulaContext, MONTHS } from '@/lib/budget-structure';

export interface DashboardSection {
  id: string;
  name: string;
  display_order: number;
}

export interface DashboardRow {
  id: string;
  section_id: string;
  row_key: string;
  name: string;
  data_type: 'currency' | 'integer' | 'percent' | 'decimal';
  calculation_type: 'manual' | 'calculated';
  formula: string | null;
  display_order: number;
}

export interface SectionSummary {
  name: string;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
}

export interface MonthlyData {
  month: string;
  monthNumber: number;
  budget: number;
  actual: number;
  variance: number;
}

export interface Facility {
  id: string;
  name: string;
  code: string;
}

export function useDashboardData(selectedYear: number, facilityId: string | null = null) {
  const [sections, setSections] = useState<DashboardSection[]>([]);
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [budgetValues, setBudgetValues] = useState<Record<string, Record<number, number>>>({});
  const [actualValues, setActualValues] = useState<Record<string, Record<number, number>>>({});
  const [dailyOpsActuals, setDailyOpsActuals] = useState<Record<number, { revenue: number; expense: number }>>({});
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetYearId, setBudgetYearId] = useState<string | null>(null);

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

  // Load sections and rows
  useEffect(() => {
    async function loadStructure() {
      const [sectionsResult, rowsResult] = await Promise.all([
        supabase
          .from('budget_sections')
          .select('id, name, display_order')
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('budget_rows')
          .select('id, section_id, row_key, name, data_type, calculation_type, formula, display_order')
          .eq('is_active', true)
          .order('display_order'),
      ]);

      if (!sectionsResult.error && sectionsResult.data) {
        setSections(sectionsResult.data);
      }
      if (!rowsResult.error && rowsResult.data) {
        setRows(rowsResult.data as DashboardRow[]);
      }
    }
    loadStructure();
  }, []);

  // Load budget year and data
  useEffect(() => {
    async function loadData() {
      if (!selectedYear || sections.length === 0 || rows.length === 0) return;
      
      setLoading(true);

      // Get budget year
      const { data: yearData } = await supabase
        .from('budget_years')
        .select('id')
        .eq('year', selectedYear)
        .maybeSingle();

      if (!yearData) {
        setBudgetValues({});
        setActualValues({});
        setBudgetYearId(null);
        setLoading(false);
        return;
      }

      setBudgetYearId(yearData.id);

      // Load budget values
      let budgetQuery = supabase
        .from('budgets')
        .select('row_id, month, value')
        .eq('budget_year_id', yearData.id);
      
      if (facilityId) {
        budgetQuery = budgetQuery.eq('facility_id', facilityId);
      }

      const { data: budgets } = await budgetQuery;

      // Load actual data from daily_operations (census days and rates to calculate revenue)
      let dailyOpsQuery = supabase
        .from('daily_operations')
        .select('date, mcr_full_days, rate_mcr_full_days, mcr_co_days, rate_mcr_co_days, mcr_lifetime_days, rate_mcr_lifetime_days, hmo_pt_days, rate_hmo, medicaid_pt_days, rate_medicaid, commercial_pt_days, rate_commercial, private_pay_pt_days, rate_private_pay, charity_indigent_pt_days, rate_charity_indigent, total_payroll')
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`)
        .eq('status', 'submitted');
      
      if (facilityId) {
        dailyOpsQuery = dailyOpsQuery.eq('facility_id', facilityId);
      }

      const { data: dailyOps } = await dailyOpsQuery;

      // Transform budget values
      const budgetMap: Record<string, Record<number, number>> = {};
      (budgets || []).forEach((b) => {
        if (!budgetMap[b.row_id]) budgetMap[b.row_id] = {};
        budgetMap[b.row_id][b.month] = Number(b.value);
      });

      // Aggregate daily operations actuals by month
      // Calculate total revenue per day (census days × rates) and sum by month
      const monthlyActuals: Record<number, { revenue: number; expense: number }> = {};
      (dailyOps || []).forEach((op) => {
        const month = new Date(op.date).getMonth() + 1;
        if (!monthlyActuals[month]) {
          monthlyActuals[month] = { revenue: 0, expense: 0 };
        }
        // Calculate revenue from census days × rates
        const dailyRevenue = 
          (Number(op.mcr_full_days || 0) * Number(op.rate_mcr_full_days || 0)) +
          (Number(op.mcr_co_days || 0) * Number(op.rate_mcr_co_days || 0)) +
          (Number(op.mcr_lifetime_days || 0) * Number(op.rate_mcr_lifetime_days || 0)) +
          (Number(op.hmo_pt_days || 0) * Number(op.rate_hmo || 0)) +
          (Number(op.medicaid_pt_days || 0) * Number(op.rate_medicaid || 0)) +
          (Number(op.commercial_pt_days || 0) * Number(op.rate_commercial || 0)) +
          (Number(op.private_pay_pt_days || 0) * Number(op.rate_private_pay || 0)) +
          (Number(op.charity_indigent_pt_days || 0) * Number(op.rate_charity_indigent || 0));
        
        monthlyActuals[month].revenue += dailyRevenue;
        monthlyActuals[month].expense += Number(op.total_payroll || 0);
      });

      // Store aggregated actuals in state
      const actualMap: Record<string, Record<number, number>> = {};

      setBudgetValues(budgetMap);
      setActualValues(actualMap);
      setDailyOpsActuals(monthlyActuals);
      setLoading(false);
    }

    loadData();
  }, [selectedYear, facilityId, sections.length, rows.length]);

  // Calculate values including formulas
  const calculatedBudget = useMemo(() => {
    const calculatedRows = rows.filter(r => r.calculation_type === 'calculated');
    const result: Record<string, Record<number, number>> = { ...budgetValues };

    for (let month = 1; month <= 12; month++) {
      const context: FormulaContext = {};
      
      rows.forEach(row => {
        if (row.calculation_type === 'manual') {
          context[row.row_key] = budgetValues[row.id]?.[month] || 0;
        }
      });

      for (let pass = 0; pass < 3; pass++) {
        calculatedRows.forEach(row => {
          if (row.formula) {
            const calcValue = evaluateFormula(row.formula, context);
            if (calcValue !== null) {
              context[row.row_key] = calcValue;
              if (!result[row.id]) result[row.id] = {};
              result[row.id][month] = calcValue;
            }
          }
        });
      }
    }
    return result;
  }, [rows, budgetValues]);

  const calculatedActual = useMemo(() => {
    const calculatedRows = rows.filter(r => r.calculation_type === 'calculated');
    const result: Record<string, Record<number, number>> = { ...actualValues };

    for (let month = 1; month <= 12; month++) {
      const context: FormulaContext = {};
      
      rows.forEach(row => {
        if (row.calculation_type === 'manual') {
          context[row.row_key] = actualValues[row.id]?.[month] || 0;
        }
      });

      for (let pass = 0; pass < 3; pass++) {
        calculatedRows.forEach(row => {
          if (row.formula) {
            const calcValue = evaluateFormula(row.formula, context);
            if (calcValue !== null) {
              context[row.row_key] = calcValue;
              if (!result[row.id]) result[row.id] = {};
              result[row.id][month] = calcValue;
            }
          }
        });
      }
    }
    return result;
  }, [rows, actualValues]);

  // Calculate section summaries
  const sectionSummaries = useMemo((): SectionSummary[] => {
    return sections.map(section => {
      const sectionRows = rows.filter(r => r.section_id === section.id);
      
      let budget = 0;
      let actual = 0;
      
      sectionRows.forEach(row => {
        for (let month = 1; month <= 12; month++) {
          budget += calculatedBudget[row.id]?.[month] || 0;
          actual += calculatedActual[row.id]?.[month] || 0;
        }
      });

      const variance = actual - budget;
      const variancePercent = budget !== 0 ? (variance / budget) * 100 : 0;

      return {
        name: section.name,
        budget,
        actual,
        variance,
        variancePercent,
      };
    });
  }, [sections, rows, calculatedBudget, calculatedActual]);

  // Calculate monthly trend data using daily operations actuals
  const monthlyData = useMemo((): MonthlyData[] => {
    return MONTHS.map((month, index) => {
      const monthNumber = index + 1;
      let budget = 0;

      // Sum budget across all rows for this month
      rows.forEach(row => {
        budget += calculatedBudget[row.id]?.[monthNumber] || 0;
      });

      // Use daily operations actuals (revenue) for the actual value
      const actual = dailyOpsActuals[monthNumber]?.revenue || 0;

      return {
        month,
        monthNumber,
        budget,
        actual,
        variance: actual - budget,
      };
    });
  }, [rows, calculatedBudget, dailyOpsActuals]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalBudget = monthlyData.reduce((sum, m) => sum + m.budget, 0);
    const totalActual = monthlyData.reduce((sum, m) => sum + m.actual, 0);
    const variance = totalActual - totalBudget;
    const variancePercent = totalBudget !== 0 ? (variance / totalBudget) * 100 : 0;

    // Get current month for YTD
    const currentMonth = new Date().getMonth() + 1;
    const ytdBudget = monthlyData
      .filter(m => m.monthNumber <= currentMonth)
      .reduce((sum, m) => sum + m.budget, 0);
    const ytdActual = monthlyData
      .filter(m => m.monthNumber <= currentMonth)
      .reduce((sum, m) => sum + m.actual, 0);
    const ytdVariance = ytdActual - ytdBudget;
    const ytdVariancePercent = ytdBudget !== 0 ? (ytdVariance / ytdBudget) * 100 : 0;

    // Find revenue and expense sections for budget KPIs
    const revenueSections = sectionSummaries.filter(s => 
      s.name.toLowerCase().includes('revenue') || 
      s.name.toLowerCase().includes('program revenue')
    );
    const expenseSections = sectionSummaries.filter(s => 
      s.name.toLowerCase().includes('expense') || 
      s.name.toLowerCase().includes('cost') ||
      s.name.toLowerCase().includes('labor')
    );

    const totalRevenueBudget = revenueSections.reduce((sum, s) => sum + s.budget, 0);
    // Use dailyOpsActuals for actual revenue (same as chart and YTD)
    const totalRevenueActual = totalActual;
    const totalExpenseBudget = expenseSections.reduce((sum, s) => sum + s.budget, 0);
    const totalExpenseActual = expenseSections.reduce((sum, s) => sum + s.actual, 0);

    return {
      totalBudget,
      totalActual,
      variance,
      variancePercent,
      ytdBudget,
      ytdActual,
      ytdVariance,
      ytdVariancePercent,
      totalRevenueBudget,
      totalRevenueActual,
      totalExpenseBudget,
      totalExpenseActual,
      currentMonth,
    };
  }, [monthlyData, sectionSummaries]);

  // Variance chart data (absolute values)
  const varianceChartData = useMemo(() => {
    return monthlyData.map(m => ({
      month: m.month,
      variance: m.variance,
    }));
  }, [monthlyData]);

  // Variance percentage chart data
  const variancePercentChartData = useMemo(() => {
    return monthlyData.map(m => ({
      month: m.month,
      budget: m.budget,
      actual: m.actual,
      variancePercent: m.budget !== 0 ? ((m.actual - m.budget) / Math.abs(m.budget)) * 100 : 0,
    }));
  }, [monthlyData]);

  // Budget vs Actual chart data
  const budgetVsActualChartData = useMemo(() => {
    return monthlyData.map(m => ({
      month: m.month,
      budget: m.budget,
      actual: m.actual,
    }));
  }, [monthlyData]);

  return {
    sections,
    rows,
    facilities,
    sectionSummaries,
    monthlyData,
    kpis,
    varianceChartData,
    variancePercentChartData,
    budgetVsActualChartData,
    loading,
    budgetYearId,
    calculatedBudget,
    calculatedActual,
  };
}
