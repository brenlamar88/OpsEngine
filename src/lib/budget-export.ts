import type { BudgetRow, BudgetSection, BudgetValues } from '@/hooks/useBudgetData';

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Generate a CSV template for budget data
 * 
 * @param rows - Budget rows from the database
 * @param sections - Budget sections for ordering
 * @param values - Current budget values (optional, for export with data)
 * @param includeData - Whether to include current values or generate empty template
 * @returns CSV string ready for download
 */
export function generateBudgetCSV(
  rows: BudgetRow[],
  sections: BudgetSection[],
  values: BudgetValues,
  includeData: boolean
): string {
  // Generate CSV header
  const header = ['row_key', 'Row Name', ...MONTH_NAMES];
  
  // Sort rows by section order, then by display order within section
  const sectionOrder = new Map(sections.map((s, idx) => [s.id, idx]));
  const sortedRows = [...rows].sort((a, b) => {
    const sectionDiff = (sectionOrder.get(a.section_id) ?? 999) - (sectionOrder.get(b.section_id) ?? 999);
    if (sectionDiff !== 0) return sectionDiff;
    return a.display_order - b.display_order;
  });
  
  // Filter to only manual-entry rows that accept budget input
  const exportableRows = sortedRows.filter(
    r => r.calculation_type === 'manual' && r.entry_mode !== 'actual_only'
  );
  
  // Generate data rows
  const dataRows = exportableRows.map(row => {
    const monthValues = MONTH_NAMES.map((_, idx) => {
      const month = idx + 1;
      if (includeData) {
        const value = values[row.id]?.[month];
        return value !== undefined ? formatCSVValue(value) : '';
      }
      return '';
    });
    
    // Escape row name if it contains commas or quotes
    const escapedName = escapeCSVField(row.name);
    
    return [row.row_key, escapedName, ...monthValues];
  });
  
  // Combine header and data rows, convert to CSV string
  return [header, ...dataRows].map(row => row.join(',')).join('\n');
}

/**
 * Format a number for CSV output
 */
function formatCSVValue(value: number): string {
  // Round to 4 decimal places to avoid floating point issues
  const rounded = Math.round(value * 10000) / 10000;
  return rounded.toString();
}

/**
 * Escape a field for CSV format
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Trigger a download of a CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a filename for the budget export
 */
export function generateBudgetFilename(
  year: number,
  facilityName?: string,
  unitName?: string,
  isTemplate: boolean = false
): string {
  const parts = ['budget'];
  if (facilityName) {
    parts.push(facilityName.toLowerCase().replace(/\s+/g, '-'));
  }
  if (unitName) {
    parts.push(unitName.toLowerCase().replace(/\s+/g, '-'));
  }
  parts.push(year.toString());
  if (isTemplate) {
    parts.push('template');
  }
  return `${parts.join('_')}.csv`;
}

/**
 * Parse a row_key column from imported CSV for exact matching
 */
export function parseRowKeyFromCSV(
  csvRow: string[],
  headerRow: string[]
): string | null {
  const rowKeyIndex = headerRow.findIndex(
    h => h.toLowerCase().trim() === 'row_key'
  );
  
  if (rowKeyIndex === -1) {
    return null;
  }
  
  const rowKey = csvRow[rowKeyIndex]?.trim();
  return rowKey || null;
}
