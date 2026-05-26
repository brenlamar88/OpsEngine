import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

interface BudgetRow {
  id: string;
  name: string;
  row_key: string;
  section_name: string;
  data_type: string;
}

interface EntryData {
  value: string;
  notes: string;
  status: 'draft' | 'submitted';
}

export function useDailyActuals(date: Date, facilityId: string | null, unitId: string | null) {
  const { user } = useAuth();
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [entries, setEntries] = useState<Record<string, EntryData>>({});
  const [budgetYearId, setBudgetYearId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load budget year for the selected date
  useEffect(() => {
    async function loadBudgetYear() {
      const year = date.getFullYear();
      const { data, error } = await supabase
        .from('budget_years')
        .select('id')
        .eq('year', year)
        .maybeSingle();

      if (error) {
        console.error('Error loading budget year:', error);
        return;
      }

      setBudgetYearId(data?.id || null);
    }

    loadBudgetYear();
  }, [date]);

  // Load actual-enabled rows
  useEffect(() => {
    async function loadRows() {
      const { data, error } = await supabase
        .from('budget_rows')
        .select(`
          id,
          name,
          row_key,
          data_type,
          section:budget_sections!inner(name)
        `)
        .in('entry_mode', ['actual_only', 'both'])
        .eq('is_active', true)
        .eq('calculation_type', 'manual')
        .order('display_order');

      if (error) {
        console.error('Error loading rows:', error);
        return;
      }

      setRows(
        (data || []).map((row) => ({
          id: row.id,
          name: row.name,
          row_key: row.row_key,
          data_type: row.data_type,
          section_name: (row.section as { name: string }).name,
        }))
      );
    }

    loadRows();
  }, []);

  // Load existing entries for the selected date
  useEffect(() => {
    async function loadEntries() {
      if (!budgetYearId) {
        setEntries({});
        setLoading(false);
        return;
      }

      setLoading(true);
      const dateStr = format(date, 'yyyy-MM-dd');

      let query = supabase
        .from('actual_entries')
        .select('row_id, value, notes, status')
        .eq('budget_year_id', budgetYearId)
        .eq('date', dateStr);

      if (facilityId) {
        query = query.eq('facility_id', facilityId);
      } else {
        query = query.is('facility_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading entries:', error);
        setLoading(false);
        return;
      }

      const entriesMap: Record<string, EntryData> = {};
      (data || []).forEach((entry) => {
        entriesMap[entry.row_id] = {
          value: entry.value?.toString() || '',
          notes: entry.notes || '',
          status: entry.status as 'draft' | 'submitted',
        };
      });

      setEntries(entriesMap);
      setLoading(false);
    }

    loadEntries();
  }, [date, budgetYearId, facilityId]);

  const updateEntry = (rowId: string, field: 'value' | 'notes', val: string) => {
    setEntries((prev) => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: val,
        status: 'draft',
      },
    }));
  };

  const saveEntries = async (status: 'draft' | 'submitted') => {
    if (!user || !budgetYearId || !unitId) {
      toast.error('Unable to save: missing user, budget year, or unit');
      return;
    }

    setSaving(true);
    const dateStr = format(date, 'yyyy-MM-dd');

    try {
      // Delete existing entries for this date/unit
      const { error: deleteError } = await supabase
        .from('actual_entries')
        .delete()
        .eq('budget_year_id', budgetYearId)
        .eq('date', dateStr)
        .eq('unit_id', unitId);

      if (deleteError) throw deleteError;

      // Insert new entries
      const rowsToSave = Object.entries(entries).filter(
        ([, entry]) => entry.value && entry.value.trim() !== ''
      );

      if (rowsToSave.length > 0) {
        const insertData = rowsToSave.map(([rowId, entry]) => ({
          budget_year_id: budgetYearId,
          date: dateStr,
          row_id: rowId,
          value: parseFloat(entry.value) || 0,
          notes: entry.notes || null,
          status,
          submitted_by: user.id,
          facility_id: facilityId,
          unit_id: unitId,
        }));

        const { error } = await supabase.from('actual_entries').insert(insertData);

        if (error) throw error;
      }

      toast.success(status === 'submitted' ? 'Entries submitted' : 'Draft saved');
    } catch (error) {
      console.error('Error saving entries:', error);
      toast.error('Failed to save entries');
    } finally {
      setSaving(false);
    }
  };

  const copyYesterday = async () => {
    if (!budgetYearId) {
      toast.error('No budget year found for selected date');
      return;
    }

    const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');

    let query = supabase
      .from('actual_entries')
      .select('row_id, value, notes')
      .eq('budget_year_id', budgetYearId)
      .eq('date', yesterdayStr);

    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    } else {
      query = query.is('facility_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error copying yesterday:', error);
      toast.error('Failed to copy yesterday\'s entries');
      return;
    }

    if (!data || data.length === 0) {
      toast.info('No entries found for yesterday');
      return;
    }

    const entriesMap: Record<string, EntryData> = {};
    data.forEach((entry) => {
      entriesMap[entry.row_id] = {
        value: entry.value?.toString() || '',
        notes: entry.notes || '',
        status: 'draft',
      };
    });

    setEntries(entriesMap);
    toast.success(`Copied ${data.length} entries from yesterday`);
  };

  return {
    rows,
    entries,
    loading,
    saving,
    budgetYearId,
    updateEntry,
    saveEntries,
    copyYesterday,
  };
}
