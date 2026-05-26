import { useState, useMemo, useCallback, Fragment, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFacilityAccess } from '@/hooks/useFacilityAccess';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Save, ChevronDown, ChevronRight, Loader2, Building2 } from 'lucide-react';
import { MONTHS, formatValue } from '@/lib/budget-structure';
import { cn } from '@/lib/utils';
import { useBudgetData } from '@/hooks/useBudgetData';
import { Skeleton } from '@/components/ui/skeleton';
import { CSVImportDialog } from '@/components/budget/CSVImportDialog';
import { BudgetExportButton } from '@/components/budget/BudgetExportButton';
import { supabase } from '@/integrations/supabase/client';

interface Facility {
  id: string;
  name: string;
  code: string;
}

// DecimalInput component for ALOS field - preserves decimal point during typing
interface DecimalInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function DecimalInput({ value, onChange, disabled }: DecimalInputProps) {
  const [localValue, setLocalValue] = useState(value?.toString() || '');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value ? value.toString() : '');
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^0-9.-]/g, '');
    setLocalValue(cleaned);
    
    const num = parseFloat(cleaned);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const num = parseFloat(localValue);
    if (!isNaN(num)) {
      onChange(num);
      setLocalValue(num.toString());
    } else {
      setLocalValue(value ? value.toString() : '');
    }
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      className="h-8 text-right font-mono text-sm w-full"
      value={localValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      placeholder="0"
      disabled={disabled}
    />
  );
}

export default function BudgetEntry() {
  const { canEdit } = useAuth();
  const { filterFacilities } = useFacilityAccess();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [allFacilities, setAllFacilities] = useState<Facility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [units, setUnits] = useState<{ id: string; name: string; unit_type: string }[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<string>('INPATIENT');

  // Filter facilities based on user access
  const facilities = useMemo(() => 
    filterFacilities(allFacilities), 
    [allFacilities, filterFacilities]
  );

  // Load facilities
  useEffect(() => {
    async function loadFacilities() {
      const { data } = await supabase.from('facilities').select('*').eq('is_active', true).order('name');
      if (data) setAllFacilities(data);
    }
    loadFacilities();
  }, []);

  // Load units when facility changes
  useEffect(() => {
    async function loadUnits() {
      if (!selectedFacility) {
        setUnits([]);
        setSelectedUnit(null);
        setSelectedUnitType('INPATIENT');
        return;
      }
      const { data } = await supabase
        .from('units')
        .select('id, name, unit_type')
        .eq('facility_id', selectedFacility)
        .eq('is_active', true)
        .order('name');
      setUnits((data as { id: string; name: string; unit_type: string }[]) || []);
      setSelectedUnit(null);
      setSelectedUnitType('INPATIENT');
    }
    loadUnits();
  }, [selectedFacility]);

  // Update unit type when unit changes
  useEffect(() => {
    if (selectedUnit) {
      const unit = units.find(u => u.id === selectedUnit);
      if (unit) {
        setSelectedUnitType(unit.unit_type);
      }
    }
  }, [selectedUnit, units]);

  const {
    sections,
    rows,
    budgetYear,
    values,
    loading,
    saving,
    updateValue,
    saveValues,
    getCalculatedValues,
    getRowTotal,
  } = useBudgetData(selectedYear, selectedFacility, selectedUnit, selectedUnitType);

  // Calculate all values including calculated rows
  const calculatedValues = useMemo(() => getCalculatedValues(), [getCalculatedValues]);

  // Group rows by section
  const rowsBySection = useMemo(() => {
    const map = new Map<string, typeof rows>();
    sections.forEach(section => {
      const sectionRows = rows
        .filter(r => r.section_id === section.id)
        .sort((a, b) => a.display_order - b.display_order);
      map.set(section.id, sectionRows);
    });
    return map;
  }, [sections, rows]);

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((s) => s !== sectionId) : [...prev, sectionId]
    );
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSections(sections.map(s => s.id));
  }, [sections]);

  const collapseAll = useCallback(() => {
    setExpandedSections([]);
  }, []);

  const handleValueChange = useCallback((rowId: string, month: number, inputValue: string) => {
    // Allow empty string, decimal point, and negative numbers during input
    const cleanValue = inputValue.replace(/[^0-9.-]/g, '');
    const numValue = cleanValue === '' || cleanValue === '-' || cleanValue === '.' ? 0 : parseFloat(cleanValue);
    updateValue(rowId, month, isNaN(numValue) ? 0 : numValue);
  }, [updateValue]);

  const handleSave = async () => {
    await saveValues();
  };

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear - 2; y <= currentYear + 3; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  if (loading && sections.length === 0) {
    return (
      <div className="min-h-screen p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-8">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isLocked = budgetYear?.is_locked ?? false;
  const canEditBudget = canEdit && !isLocked;

  return (
    <div className="min-h-screen p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Budget Entry</h1>
          <p className="text-sm text-muted-foreground">
            Enter monthly budget values for {selectedYear}
            {isLocked && <span className="ml-2 text-amber-500">(Locked)</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select 
            value={selectedFacility || ''} 
            onValueChange={(v) => setSelectedFacility(v || null)}
          >
            <SelectTrigger className="w-[180px]">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select Facility" />
            </SelectTrigger>
            <SelectContent>
              {facilities.map(f => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={selectedUnit || ''} 
            onValueChange={(v) => setSelectedUnit(v || null)}
            disabled={!selectedFacility}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select Unit" />
            </SelectTrigger>
            <SelectContent>
              {units.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[120px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={expandAll}>Expand All</Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>Collapse All</Button>
          {selectedUnitType !== 'IOP' && (
            <>
              <BudgetExportButton
                rows={rows}
                sections={sections}
                values={values}
                selectedYear={selectedYear}
                facilityName={facilities.find(f => f.id === selectedFacility)?.name}
                unitName={units.find(u => u.id === selectedUnit)?.name}
                disabled={!selectedUnit}
              />
              <CSVImportDialog 
                selectedYear={selectedYear} 
                budgetYearId={budgetYear?.id || null}
                onImportComplete={() => window.location.reload()}
                preselectedFacility={selectedFacility}
                preselectedUnit={selectedUnit}
              />
            </>
          )}
          <Button 
            variant="default" 
            onClick={handleSave} 
            disabled={!canEditBudget || saving || !selectedUnit}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Budget
          </Button>
        </div>
      </div>

      {!selectedUnit ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg text-muted-foreground mb-2">
            Select a facility and unit to view and edit budget data
          </p>
          <p className="text-sm text-muted-foreground">
            Choose a facility and unit from the dropdowns above to get started.
          </p>
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-lg text-muted-foreground mb-4">
            No budget structure found. Please seed the database first.
          </p>
          <p className="text-sm text-muted-foreground">
            Go to Admin Settings to seed the budget structure.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="sticky left-0 z-10 bg-muted px-4 py-3 text-left font-medium min-w-[280px]">
                  Line Item
                </th>
                {MONTHS.map((m) => (
                  <th key={m} className="px-2 py-3 text-right font-medium min-w-[95px]">
                    {m}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium min-w-[110px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => {
                const sectionRows = rowsBySection.get(section.id) || [];
                const isExpanded = expandedSections.includes(section.id);
                
                // Calculate section total
                const sectionTotal = sectionRows.reduce((sum, row) => {
                  return sum + getRowTotal(row.id, calculatedValues);
                }, 0);

                return (
                  <Fragment key={section.id}>
                    <tr
                      className="section-row cursor-pointer hover:bg-muted/50 bg-muted/30"
                      onClick={() => toggleSection(section.id)}
                    >
                      <td className="sticky left-0 z-10 bg-muted/30 px-4 py-3 font-semibold">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {section.name}
                          <span className="text-xs text-muted-foreground ml-2">
                            ({sectionRows.length} rows)
                          </span>
                        </div>
                      </td>
                      {MONTHS.map((m) => (
                        <td key={m} className="px-2 py-3 text-right text-muted-foreground">
                          —
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {formatValue(sectionTotal, 'currency')}
                      </td>
                    </tr>
                    {isExpanded &&
                      sectionRows.map((row) => {
                        const isCalculated = row.calculation_type === 'calculated';
                        const isActualOnly = row.entry_mode === 'actual_only';
                        const rowTotal = getRowTotal(row.id, calculatedValues);

                        return (
                          <tr
                            key={row.id}
                            className="border-b border-border/50 hover:bg-muted/20"
                          >
                            <td
                              className={cn(
                                "sticky left-0 z-10 bg-card px-4 py-2 pl-10",
                                isCalculated && "text-muted-foreground italic"
                              )}
                            >
                              {row.name}
                              {isCalculated && (
                                <span className="ml-2 text-xs text-primary/60">(calc)</span>
                              )}
                            </td>
                            {MONTHS.map((_, monthIndex) => {
                              const month = monthIndex + 1;
                              const cellValue = calculatedValues[row.id]?.[month] || 0;
                              
                              if (isCalculated || isActualOnly) {
                                return (
                                  <td
                                    key={month}
                                    className="px-2 py-2 text-right font-mono text-sm text-muted-foreground"
                                  >
                                    {formatValue(cellValue, row.data_type)}
                                  </td>
                                );
                              }

                              // Use DecimalInput for ALOS fields (Medicare ALOS and Total ALOS)
                              const isAlosField = row.row_key === 'alos' || row.row_key === 'total_alos';
                              
                              if (isAlosField) {
                                return (
                                  <td key={month} className="px-1 py-1">
                                    <DecimalInput
                                      value={values[row.id]?.[month] || 0}
                                      onChange={(val) => updateValue(row.id, month, val)}
                                      disabled={!canEditBudget}
                                    />
                                  </td>
                                );
                              }

                              return (
                                <td key={month} className="px-1 py-1">
                                  <Input
                                    type="text"
                                    inputMode={row.data_type === 'integer' ? 'numeric' : 'decimal'}
                                    className="h-8 text-right font-mono text-sm w-full"
                                    value={values[row.id]?.[month] !== undefined ? values[row.id][month] : ''}
                                    onChange={(e) =>
                                      handleValueChange(row.id, month, e.target.value)
                                    }
                                    placeholder="0"
                                    disabled={!canEditBudget}
                                    step={row.data_type === 'decimal' || row.data_type === 'percent' ? '0.01' : '1'}
                                  />
                                </td>
                              );
                            })}
                            <td className="px-4 py-2 text-right font-mono font-semibold">
                              {formatValue(rowTotal, row.data_type)}
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && sections.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading budget data...</span>
        </div>
      )}
    </div>
  );
}
