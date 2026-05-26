import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { evaluateFormula, type FormulaContext, defaultBudgetStructure, iopBudgetStructure, type BudgetStructure } from '@/lib/budget-structure';

export interface BudgetSection {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export interface BudgetRow {
  id: string;
  section_id: string;
  row_key: string;
  name: string;
  data_type: 'currency' | 'integer' | 'percent' | 'decimal';
  entry_mode: 'budget_only' | 'actual_only' | 'both';
  calculation_type: 'manual' | 'calculated';
  formula: string | null;
  display_order: number;
  is_active: boolean;
}

export interface BudgetYear {
  id: string;
  year: number;
  is_locked: boolean;
  locked_at: string | null;
  locked_by_user_id: string | null;
}

export interface BudgetValue {
  id?: string;
  budget_year_id: string;
  row_id: string;
  month: number;
  value: number;
  facility_id?: string | null;
}

// Monthly values keyed by row_id, then month (1-12)
export type BudgetValues = Record<string, Record<number, number>>;

export function useBudgetData(selectedYear: number, facilityId: string | null = null, unitId: string | null = null, unitType: string = 'INPATIENT') {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [sections, setSections] = useState<BudgetSection[]>([]);
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [budgetYear, setBudgetYear] = useState<BudgetYear | null>(null);
  const [budgetYears, setBudgetYears] = useState<BudgetYear[]>([]);
  const [values, setValues] = useState<BudgetValues>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Request id refs to prevent stale async responses from overwriting newer state.
  // This fixes a race condition where rapidly switching year/facility/unit could
  // cause an older slow response to land after a newer one and "change" the
  // displayed numbers a few seconds after the page settled.
  const structureRequestIdRef = useRef(0);
  const valuesRequestIdRef = useRef(0);

  // Get the correct budget structure based on unit type
  const budgetStructure: BudgetStructure = useMemo(() => {
    return unitType === 'IOP' ? iopBudgetStructure : defaultBudgetStructure;
  }, [unitType]);

  // Load budget years
  useEffect(() => {
    async function loadBudgetYears() {
      const { data, error } = await supabase
        .from('budget_years')
        .select('*')
        .order('year', { ascending: false });
      
      if (error) {
        console.error('Error loading budget years:', error);
        return;
      }
      
      setBudgetYears(data || []);
    }
    
    loadBudgetYears();
  }, []);

  // Load sections and rows based on unit type budget structure
  useEffect(() => {
    const requestId = ++structureRequestIdRef.current;
    async function loadStructure() {
      // Load from database to get the IDs, but filter based on the budget structure
      const [sectionsResult, rowsResult] = await Promise.all([
        supabase
          .from('budget_sections')
          .select('*')
          .eq('is_active', true)
          .order('display_order'),
        supabase
          .from('budget_rows')
          .select('*')
          .eq('is_active', true)
          .order('display_order'),
      ]);

      if (sectionsResult.error) {
        console.error('Error loading sections:', sectionsResult.error);
        if (requestId !== structureRequestIdRef.current) return;
        toast({
          title: 'Error loading budget structure',
          description: sectionsResult.error.message,
          variant: 'destructive',
        });
        return;
      }

      if (rowsResult.error) {
        console.error('Error loading rows:', rowsResult.error);
        if (requestId !== structureRequestIdRef.current) return;
        toast({
          title: 'Error loading budget rows',
          description: rowsResult.error.message,
          variant: 'destructive',
        });
        return;
      }

      // Get section names from the current budget structure
      const structureSectionNames = new Set(budgetStructure.sections.map(s => s.name));
      
      // Filter sections and rows based on budget structure
      const filteredSections = (sectionsResult.data || []).filter(s => structureSectionNames.has(s.name));
      
      // Get the row keys from the budget structure
      const structureRowKeys = new Set(
        budgetStructure.sections.flatMap(s => s.rows.map(r => r.row_key))
      );
      
      // Get section IDs that are in our filtered sections
      const filteredSectionIds = new Set(filteredSections.map(s => s.id));
      
      // Filter rows to only those in our sections AND in the budget structure
      const filteredRows = (rowsResult.data as BudgetRow[] || []).filter(
        r => filteredSectionIds.has(r.section_id) && structureRowKeys.has(r.row_key)
      );

      // Bail out if a newer request superseded us
      if (requestId !== structureRequestIdRef.current) return;

      setSections(filteredSections);
      setRows(filteredRows);
    }

    loadStructure();
  }, [toast, budgetStructure]);

  // Load budget year and values when year changes
  useEffect(() => {
    const requestId = ++valuesRequestIdRef.current;
    // Clear stale values immediately so the UI shows skeletons instead of
    // numbers from a previous selection.
    setValues({});
    async function loadBudgetData() {
      if (!selectedYear) return;
      
      setLoading(true);

      // First, try to fetch the budget year directly from the database
      // instead of relying on the potentially stale budgetYears state
      const { data: existingYear, error: fetchError } = await supabase
        .from('budget_years')
        .select('*')
        .eq('year', selectedYear)
        .maybeSingle();

      if (requestId !== valuesRequestIdRef.current) return;

      if (fetchError) {
        console.error('Error fetching budget year:', fetchError);
        setLoading(false);
        return;
      }

      let yearData = existingYear;

      // Only create if it doesn't exist and we have a user
      if (!yearData && user) {
        const { data: newYear, error: yearError } = await supabase
          .from('budget_years')
          .insert({ year: selectedYear })
          .select()
          .single();

        if (requestId !== valuesRequestIdRef.current) return;

        if (yearError) {
          console.error('Error creating budget year:', yearError);
          setLoading(false);
          return;
        }
        
        yearData = newYear;
        setBudgetYears(prev => [...prev, newYear]);
      }

      if (!yearData) {
        setLoading(false);
        return;
      }

      setBudgetYear(yearData);

      // Load budget values - use pagination to fetch ALL rows (Supabase default limit is 1000)
      const allBudgetData: Array<{
        id: string;
        budget_year_id: string;
        row_id: string;
        month: number;
        value: number;
        facility_id: string | null;
        created_at: string;
        created_by: string;
        updated_at: string;
      }> = [];
      
      let hasMore = true;
      let offset = 0;
      const pageSize = 1000;
      
      while (hasMore) {
        let query = supabase
          .from('budgets')
          .select('*')
          .eq('budget_year_id', yearData.id);
        
        // When a specific facility is selected, filter by that facility
        if (facilityId) {
          query = query.eq('facility_id', facilityId);
        }
        
        // When a specific unit is selected, filter by that unit
        if (unitId) {
          query = query.eq('unit_id', unitId);
        }
        
        // Use range for pagination to bypass the 1000 row default limit.
        // Order by (row_id, month) for a stable, non-overlapping page sequence.
        const { data: pageData, error: budgetError } = await query
          .order('row_id')
          .order('month')
          .range(offset, offset + pageSize - 1);

        if (requestId !== valuesRequestIdRef.current) return;

        if (budgetError) {
          console.error('Error loading budget values:', budgetError);
          setLoading(false);
          return;
        }

        if (pageData && pageData.length > 0) {
          allBudgetData.push(...pageData);
          offset += pageSize;
          hasMore = pageData.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log('Loaded budget entries:', allBudgetData.length, 'for year:', selectedYear, 'facility:', facilityId, 'unit:', unitId);

      // Transform into our values structure
      const valuesMap: BudgetValues = {};
      allBudgetData.forEach((b) => {
        if (!valuesMap[b.row_id]) {
          valuesMap[b.row_id] = {};
        }
        valuesMap[b.row_id][b.month] = Number(b.value);
      });

      if (requestId !== valuesRequestIdRef.current) return;

      setValues(valuesMap);
      setLoading(false);
    }

    loadBudgetData();
  }, [selectedYear, facilityId, unitId, user]);

  // Update a single value (local state)
  const updateValue = useCallback((rowId: string, month: number, value: number) => {
    setValues(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [month]: value,
      },
    }));
  }, []);

  // Calculate values for calculated rows
  const getCalculatedValues = useCallback((): BudgetValues => {
    const calculatedRows = rows.filter(r => r.calculation_type === 'calculated');
    const result: BudgetValues = { ...values };

    // Build context for formula evaluation
    for (let month = 1; month <= 12; month++) {
      const context: FormulaContext = {};
      
      // First, add all manual values
      rows.forEach(row => {
        if (row.calculation_type === 'manual') {
          context[row.row_key] = values[row.id]?.[month] || 0;
        }
      });

      // Calculate in multiple passes to handle dependency chains.
      // Use 10 passes to ensure deep dependencies are resolved properly.
      // Key dependencies:
      // Pass 1-2: Simple sums (total_patient_days, fixed/variable totals)
      // Pass 3-4: Department totals that depend on above
      // Pass 5-6: PPD calculations that depend on total_patient_days
      // Pass 7-10: Deep dependencies (EBITDA, net income, etc.)
      for (let pass = 0; pass < 10; pass++) {
        calculatedRows.forEach(row => {
          if (row.formula) {
            const calcValue = evaluateFormula(row.formula, context);
            if (calcValue !== null) {
              context[row.row_key] = calcValue;
              if (!result[row.id]) {
                result[row.id] = {};
              }
              result[row.id][month] = calcValue;
            }
          }
        });
      }

      // Debug log for month 1 to verify PPD calculations
      if (month === 1) {
        // Log patient day components
        console.log('Month 1 Patient Days Components:', {
          total_contract_rate_pt_days: context['total_contract_rate_pt_days'],
          total_medicare_adv_pt_days: context['total_medicare_adv_pt_days'],
          total_commercial_pt_days: context['total_commercial_pt_days'],
          total_medicaid_pt_days: context['total_medicaid_pt_days'],
          total_private_pay_pt_days: context['total_private_pay_pt_days'],
          total_charity_indigent_pt_days: context['total_charity_indigent_pt_days'],
        });
        console.log('Month 1 total_patient_days (calculated):', context['total_patient_days']);
        console.log('Month 1 total_admin_fixed_cost:', context['total_admin_fixed_cost']);
        console.log('Month 1 total_admin_fixed_ppd:', context['total_admin_fixed_ppd']);
        console.log('Month 1 PPD check: cost/days =', (context['total_admin_fixed_cost'] || 0) / (context['total_patient_days'] || 1));
      }
    }

    return result;
  }, [rows, values]);

  // Save all values to database
  const saveValues = useCallback(async () => {
    if (!budgetYear || !user) {
      toast({
        title: 'Unable to save',
        description: 'No budget year selected or user not authenticated',
        variant: 'destructive',
      });
      return false;
    }

    setSaving(true);

    try {
      // Get all manual rows
      const manualRows = rows.filter(r => r.calculation_type === 'manual');
      
      // Build upsert data
      if (!unitId) {
        toast({
          title: 'Unable to save',
          description: 'No unit selected',
          variant: 'destructive',
        });
        return false;
      }

      const upsertData: Array<{
        budget_year_id: string;
        row_id: string;
        month: number;
        value: number;
        created_by: string;
        facility_id: string | null;
        unit_id: string;
      }> = [];

      manualRows.forEach(row => {
        if (row.entry_mode === 'actual_only') return;
        
        for (let month = 1; month <= 12; month++) {
          const value = values[row.id]?.[month] || 0;
          upsertData.push({
            budget_year_id: budgetYear.id,
            row_id: row.id,
            month,
            value,
            created_by: user.id,
            facility_id: facilityId,
            unit_id: unitId,
          });
        }
      });

      // Delete existing entries for this year/facility/unit
      let deleteQuery = supabase
        .from('budgets')
        .delete()
        .eq('budget_year_id', budgetYear.id)
        .eq('unit_id', unitId);
      
      if (facilityId) {
        deleteQuery = deleteQuery.eq('facility_id', facilityId);
      } else {
        deleteQuery = deleteQuery.is('facility_id', null);
      }

      const { error: deleteError } = await deleteQuery;
      
      if (deleteError) {
        throw deleteError;
      }

      // Insert new values
      if (upsertData.length > 0) {
        const { error: insertError } = await supabase
          .from('budgets')
          .insert(upsertData);

        if (insertError) {
          throw insertError;
        }
      }

      toast({
        title: 'Budget saved',
        description: `Saved ${upsertData.length} budget entries for ${selectedYear}`,
      });

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving budget:', error);
      toast({
        title: 'Error saving budget',
        description: message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [budgetYear, user, rows, values, facilityId, selectedYear, toast]);

  // Get row total for a specific row
  // For PPD (per patient day) rows, we need to recalculate using annual totals
  // rather than summing monthly PPD values
  const getRowTotal = useCallback((rowId: string, calculatedValues: BudgetValues): number => {
    const row = rows.find(r => r.id === rowId);
    const rowValues = calculatedValues[rowId] || {};
    
    // Check if this is a PPD row (formula contains DIV with total_patient_days)
    if (row?.formula && row.formula.includes('total_patient_days') && row.formula.startsWith('DIV(')) {
      // Extract the numerator from the formula: DIV(numerator, total_patient_days)
      const match = row.formula.match(/^DIV\(([^,]+),\s*total_patient_days\)$/);
      if (match) {
        const numeratorKey = match[1].trim();
        // Find the row with this key to get its ID
        const numeratorRow = rows.find(r => r.row_key === numeratorKey);
        if (numeratorRow) {
          // Get annual total of the numerator
          const numeratorValues = calculatedValues[numeratorRow.id] || {};
          const numeratorTotal = Object.values(numeratorValues).reduce((sum, val) => sum + (val || 0), 0);
          
          // Get annual total of patient days
          const patientDaysRow = rows.find(r => r.row_key === 'total_patient_days');
          if (patientDaysRow) {
            const patientDaysValues = calculatedValues[patientDaysRow.id] || {};
            const patientDaysTotal = Object.values(patientDaysValues).reduce((sum, val) => sum + (val || 0), 0);
            
            if (patientDaysTotal !== 0) {
              return numeratorTotal / patientDaysTotal;
            }
          }
        }
      }
    }
    
    // For non-PPD rows, just sum the monthly values
    return Object.values(rowValues).reduce((sum, val) => sum + (val || 0), 0);
  }, [rows]);

  return {
    sections,
    rows,
    budgetYear,
    budgetYears,
    values,
    loading,
    saving,
    updateValue,
    saveValues,
    getCalculatedValues,
    getRowTotal,
  };
}
