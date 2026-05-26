import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, ClipboardCheck, CheckCircle2, XCircle, Download, FileText, FileSpreadsheet, CalendarIcon, Clock } from 'lucide-react';
import { startOfWeek, format, addDays, isAfter, startOfDay, eachDayOfInterval, isWeekend, isBefore, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DayStatus {
  label: string;
  status: 'compliant' | 'late' | 'missing';
}

interface ComplianceRow {
  facilityId: string;
  facilityName: string;
  unitId: string;
  unitName: string;
  daysCompleted: number;
  daysRequired: number;
  dayStatuses: DayStatus[];
  isCompliant: boolean;
}

/**
 * For a data entry date X, the deadline is end of day X+1.
 * "Today is March 4th, I should be entering March 3rd's data."
 * So data for March 3rd must be submitted by end of March 4th.
 */
function getDeadline(dateStr: string): Date {
  const entryDate = new Date(dateStr + 'T00:00:00');
  const nextDay = addDays(entryDate, 1);
  return endOfDay(nextDay);
}

export default function ComplianceReport() {
  const { toast } = useToast();
  const now = new Date();
  const today = startOfDay(now);
  
  const defaultStart = startOfWeek(now, { weekStartsOn: 1 });
  const defaultEnd = addDays(defaultStart, 4);
  
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);

  const getWeekdaysInRange = (start: Date, end: Date) => {
    const effectiveEnd = isAfter(end, today) ? today : end;
    if (isAfter(start, effectiveEnd)) return [];
    
    const days = eachDayOfInterval({ start, end: effectiveEnd });
    return days
      .filter(day => !isWeekend(day))
      .map(day => ({
        date: day,
        dateStr: format(day, 'yyyy-MM-dd'),
        label: format(day, 'EEE M/d')
      }));
  };

  const weekdays = getWeekdaysInRange(startDate, endDate);
  const daysRequired = weekdays.length;
  const rangeStartStr = format(startDate, 'yyyy-MM-dd');
  const rangeEndStr = format(endDate, 'yyyy-MM-dd');

  const { data: complianceData, isLoading } = useQuery({
    queryKey: ['compliance-report', rangeStartStr, rangeEndStr, daysRequired],
    queryFn: async () => {
      const { data: facilities, error: facError } = await supabase
        .from('facilities')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (facError) throw facError;

      const { data: units, error: unitError } = await supabase
        .from('units')
        .select('id, name, facility_id, operating_days')
        .eq('is_active', true)
        .order('name');
      if (unitError) throw unitError;

      // Fetch date + initial_submitted_at for compliance check
      const { data: entries, error: entryError } = await supabase
        .from('daily_operations')
        .select('unit_id, date, initial_submitted_at')
        .gte('date', rangeStartStr)
        .lte('date', rangeEndStr);
      if (entryError) throw entryError;

      // Map: unit_id -> date -> initial_submitted_at
      const unitDateMap = new Map<string, Map<string, string | null>>();
      for (const entry of entries || []) {
        if (!unitDateMap.has(entry.unit_id)) {
          unitDateMap.set(entry.unit_id, new Map());
        }
        unitDateMap.get(entry.unit_id)!.set(entry.date, entry.initial_submitted_at);
      }

      const report: ComplianceRow[] = [];
      
      for (const facility of facilities || []) {
        const facilityUnits = units?.filter(u => u.facility_id === facility.id) || [];
        
        for (const unit of facilityUnits) {
          // Filter weekdays to only this unit's operating days
          // operating_days uses ISO day numbers: 1=Mon, 2=Tue, ..., 5=Fri
          const unitOperatingDays: number[] = (unit as any).operating_days || [1, 2, 3, 4, 5];
          const unitWeekdays = weekdays.filter(wd => {
            const dayOfWeek = wd.date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            // Convert JS getDay() to ISO: Sun=7, Mon=1, Tue=2, etc.
            const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;
            return unitOperatingDays.includes(isoDay);
          });
          const unitDaysRequired = unitWeekdays.length;

          const unitDates = unitDateMap.get(unit.id) || new Map();
          const dayStatuses: DayStatus[] = [];
          let compliantDays = 0;
          
          for (const weekday of unitWeekdays) {
            const submittedAt = unitDates.get(weekday.dateStr);
            const deadline = getDeadline(weekday.dateStr);
            
            if (submittedAt === undefined) {
              dayStatuses.push({ label: weekday.label, status: 'missing' });
            } else if (submittedAt === null) {
              dayStatuses.push({ label: weekday.label, status: 'missing' });
            } else {
              const submittedDate = new Date(submittedAt);
              if (isAfter(submittedDate, deadline)) {
                dayStatuses.push({ label: weekday.label, status: 'late' });
              } else {
                dayStatuses.push({ label: weekday.label, status: 'compliant' });
                compliantDays++;
              }
            }
          }

          report.push({
            facilityId: facility.id,
            facilityName: facility.name,
            unitId: unit.id,
            unitName: unit.name,
            daysCompleted: compliantDays,
            daysRequired: unitDaysRequired,
            dayStatuses,
            isCompliant: compliantDays === unitDaysRequired,
          });
        }
      }

      return report;
    },
  });

  const compliantCount = complianceData?.filter(r => r.isCompliant).length || 0;
  const totalCount = complianceData?.length || 0;
  const complianceRate = totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0;

  const dateRangeLabel = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;

  const exportToCSV = () => {
    if (!complianceData?.length) return;

    const headers = ['Facility', 'Unit', 'Days Compliant', 'Status', 'Issues'];
    const rows = complianceData.map(row => {
      const issues = row.dayStatuses
        .filter(d => d.status !== 'compliant')
        .map(d => `${d.label} (${d.status})`)
        .join(', ');
      return [
        row.facilityName,
        row.unitName,
        `${row.daysCompleted}/${row.daysRequired}`,
        row.isCompliant ? 'Yes' : 'No',
        issues || '-'
      ];
    });

    const csvContent = [
      `Weekly Compliance Report - ${dateRangeLabel}`,
      `${compliantCount} of ${totalCount} units compliant (${complianceRate}%)`,
      `Requires on-time submission for all ${daysRequired} weekday(s) to be compliant`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `compliance_report_${format(startDate, 'yyyy-MM-dd')}.csv`;
    link.click();

    toast({ title: 'CSV exported', description: `Compliance report exported successfully.` });
  };

  const exportToPDF = () => {
    if (!complianceData?.length) return;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Weekly Compliance Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Week: ${dateRangeLabel}`, 14, 30);
    doc.text(`${compliantCount} of ${totalCount} units compliant (${complianceRate}%)`, 14, 36);
    doc.text(`Requires on-time submission for all ${daysRequired} weekday(s)`, 14, 42);

    autoTable(doc, {
      startY: 50,
      head: [['Facility', 'Unit', 'Days', 'Status', 'Issues']],
      body: complianceData.map(row => {
        const issues = row.dayStatuses
          .filter(d => d.status !== 'compliant')
          .map(d => `${d.label} (${d.status})`)
          .join(', ');
        return [
          row.facilityName,
          row.unitName,
          `${row.daysCompleted}/${row.daysRequired}`,
          row.isCompliant ? 'Yes' : 'No',
          issues || '-'
        ];
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === 'body') {
          const value = data.cell.raw as string;
          if (value === 'No') {
            data.cell.styles.textColor = [220, 38, 38];
          } else {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      }
    });

    doc.save(`compliance_report_${format(startDate, 'yyyy-MM-dd')}.pdf`);

    toast({ title: 'PDF exported', description: `Compliance report exported successfully.` });
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Weekly Compliance Report
          </CardTitle>
          <CardDescription>
            On-time submission status — Data must be submitted by end of the next day
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  disabled={(date) => isAfter(date, endDate) || isAfter(date, today)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(endDate, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => date && setEndDate(date)}
                  disabled={(date) => isBefore(date, startDate)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          {complianceData?.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !complianceData?.length ? (
          <p className="text-center text-muted-foreground py-8">No facilities or units configured.</p>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-4">
              <Badge variant={complianceRate === 100 ? 'default' : complianceRate >= 75 ? 'secondary' : 'destructive'}>
                {complianceRate}% Compliant
              </Badge>
              <span className="text-sm text-muted-foreground">
                {compliantCount} of {totalCount} units have on-time submissions for all {daysRequired} day(s)
              </span>
            </div>
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facility</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="w-24 text-center">Days</TableHead>
                    <TableHead className="w-32 text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complianceData.map((row) => {
                    const issues = row.dayStatuses.filter(d => d.status !== 'compliant');
                    const missingDays = issues.filter(d => d.status === 'missing');
                    const lateDays = issues.filter(d => d.status === 'late');

                    return (
                      <TableRow key={`${row.facilityId}-${row.unitId}`}>
                        <TableCell className="font-medium">{row.facilityName}</TableCell>
                        <TableCell>{row.unitName}</TableCell>
                        <TableCell className="text-center">
                          <span className={row.isCompliant ? 'text-primary' : 'text-destructive'}>
                            {row.daysCompleted}/{row.daysRequired}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {row.isCompliant ? (
                            <div className="flex items-center justify-center gap-1 text-primary">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-sm font-medium">Yes</span>
                            </div>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center justify-center gap-1 text-destructive cursor-help">
                                  <XCircle className="h-4 w-4" />
                                  <span className="text-sm font-medium">No</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  {missingDays.length > 0 && (
                                    <p>Missing: {missingDays.map(d => d.label).join(', ')}</p>
                                  )}
                                  {lateDays.length > 0 && (
                                    <p className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Late: {lateDays.map(d => d.label).join(', ')}
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          </>
        )}
      </CardContent>
    </Card>
  );
}
