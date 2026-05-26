import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { generateBudgetCSV, downloadCSV, generateBudgetFilename } from '@/lib/budget-export';
import type { BudgetRow, BudgetSection, BudgetValues } from '@/hooks/useBudgetData';
import { useToast } from '@/hooks/use-toast';

interface BudgetExportButtonProps {
  rows: BudgetRow[];
  sections: BudgetSection[];
  values: BudgetValues;
  selectedYear: number;
  facilityName?: string;
  unitName?: string;
  disabled?: boolean;
}

export function BudgetExportButton({
  rows,
  sections,
  values,
  selectedYear,
  facilityName,
  unitName,
  disabled = false,
}: BudgetExportButtonProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const handleExportTemplate = () => {
    try {
      const csv = generateBudgetCSV(rows, sections, values, false);
      const filename = generateBudgetFilename(selectedYear, facilityName, unitName, true);
      downloadCSV(csv, filename);
      
      toast({
        title: 'Template downloaded',
        description: `Empty template saved as ${filename}`,
      });
    } catch (error) {
      console.error('Export template error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to generate template file',
        variant: 'destructive',
      });
    }
    setIsOpen(false);
  };

  const handleExportData = () => {
    try {
      const csv = generateBudgetCSV(rows, sections, values, true);
      const filename = generateBudgetFilename(selectedYear, facilityName, unitName, false);
      downloadCSV(csv, filename);
      
      const rowCount = rows.filter(
        r => r.calculation_type === 'manual' && r.entry_mode !== 'actual_only'
      ).length;
      
      toast({
        title: 'Budget exported',
        description: `Exported ${rowCount} rows to ${filename}`,
      });
    } catch (error) {
      console.error('Export data error:', error);
      toast({
        title: 'Export failed',
        description: 'Failed to export budget data',
        variant: 'destructive',
      });
    }
    setIsOpen(false);
  };

  // Count exportable rows
  const exportableRowCount = rows.filter(
    r => r.calculation_type === 'manual' && r.entry_mode !== 'actual_only'
  ).length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || exportableRowCount === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export
          <ChevronDown className="ml-2 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleExportTemplate} className="cursor-pointer">
          <FileSpreadsheet className="mr-2 h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span>Download Empty Template</span>
            <span className="text-xs text-muted-foreground">
              {exportableRowCount} rows, no data
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportData} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span>Export Current Budget</span>
            <span className="text-xs text-muted-foreground">
              Include all entered values
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
