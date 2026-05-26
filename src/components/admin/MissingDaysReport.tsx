import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, CalendarX, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { format, eachDayOfInterval, startOfDay, startOfYear, endOfYear, isAfter } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MissingRow {
  facilityId: string;
  facilityName: string;
  unitId: string;
  unitName: string;
  unitType: string;
  expected: number;
  submitted: number;
  missing: number;
  completionPct: number;
  missingDates: string[];
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function MissingDaysReport() {
  const { toast } = useToast();
  const [year, setYear] = useState<number>(CURRENT_YEAR);

  const today = startOfDay(new Date());
  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  const effectiveEnd = isAfter(yearEnd, today) ? today : yearEnd;

  const yearStartStr = format(yearStart, 'yyyy-MM-dd');
  const endDateStr = format(effectiveEnd, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['missing-days-report', yearStartStr, endDateStr],
    queryFn: async (): Promise<MissingRow[]> => {
      const [{ data: facilities, error: facError }, { data: units, error: unitError }] = await Promise.all([
        supabase.from('facilities').select('id, name').eq('is_active', true).order('name'),
        supabase.from('units').select('id, name, facility_id, unit_type, operating_days').eq('is_active', true).order('name'),
      ]);
      if (facError) throw facError;
      if (unitError) throw unitError;

      // Paginate to bypass Supabase's 1000-row default cap
      const PAGE = 1000;
      const entries: { unit_id: string; date: string }[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data: page, error: entryError } = await supabase
          .from('daily_operations')
          .select('unit_id, date')
          .gte('date', yearStartStr)
          .lte('date', endDateStr)
          .order('date', { ascending: true })
          .range(from, from + PAGE - 1);
        if (entryError) throw entryError;
        entries.push(...(page || []));
        if (!page || page.length < PAGE) break;
      }

      const unitDates = new Map<string, Set<string>>();
      for (const e of entries || []) {
        if (!unitDates.has(e.unit_id)) unitDates.set(e.unit_id, new Set());
        unitDates.get(e.unit_id)!.add(e.date);
      }

      const allDays = eachDayOfInterval({ start: yearStart, end: effectiveEnd });

      const rows: MissingRow[] = [];
      for (const facility of facilities || []) {
        const facilityUnits = (units || []).filter(u => u.facility_id === facility.id);
        for (const unit of facilityUnits) {
          const operatingDays: number[] = (unit as any).operating_days || [1, 2, 3, 4, 5];
          const expectedDates = allDays
            .filter(d => {
              const js = d.getDay();
              const iso = js === 0 ? 7 : js;
              return operatingDays.includes(iso);
            })
            .map(d => format(d, 'yyyy-MM-dd'));

          const present = unitDates.get(unit.id) || new Set<string>();
          const missing = expectedDates.filter(d => !present.has(d));
          const submitted = expectedDates.length - missing.length;
          const completionPct = expectedDates.length > 0
            ? Math.round((submitted / expectedDates.length) * 1000) / 10
            : 100;

          rows.push({
            facilityId: facility.id,
            facilityName: facility.name,
            unitId: unit.id,
            unitName: unit.name,
            unitType: unit.unit_type || 'INPATIENT',
            expected: expectedDates.length,
            submitted,
            missing: missing.length,
            completionPct,
            missingDates: missing,
          });
        }
      }

      rows.sort((a, b) => b.missing - a.missing || a.facilityName.localeCompare(b.facilityName) || a.unitName.localeCompare(b.unitName));
      return rows;
    },
  });

  const totals = useMemo(() => {
    const r = data || [];
    const expected = r.reduce((s, x) => s + x.expected, 0);
    const submitted = r.reduce((s, x) => s + x.submitted, 0);
    const missing = r.reduce((s, x) => s + x.missing, 0);
    const pct = expected > 0 ? Math.round((submitted / expected) * 1000) / 10 : 100;
    return { expected, submitted, missing, pct };
  }, [data]);

  const rangeLabel = `${format(yearStart, 'MMM d, yyyy')} - ${format(effectiveEnd, 'MMM d, yyyy')}`;

  const exportToCSV = () => {
    if (!data?.length) return;
    const headers = ['Facility', 'Unit', 'Type', 'Operating Days YTD', 'Submitted', 'Missing', 'Completion %', 'Missing Dates'];
    const rows = data.map(r => [
      r.facilityName, r.unitName, r.unitType,
      String(r.expected), String(r.submitted), String(r.missing),
      `${r.completionPct}%`, r.missingDates.join('; '),
    ]);
    const csv = [
      `Missing Days Report - ${rangeLabel}`,
      `${totals.missing} missing of ${totals.expected} operating days (${totals.pct}% complete)`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `missing_days_report_${year}.csv`;
    link.click();
    toast({ title: 'CSV exported', description: 'Missing days report exported.' });
  };

  const exportToPDF = () => {
    if (!data?.length) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Missing Days Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Range: ${rangeLabel}`, 14, 30);
    doc.text(`${totals.missing} missing of ${totals.expected} operating days (${totals.pct}% complete)`, 14, 36);

    autoTable(doc, {
      startY: 44,
      head: [['Facility', 'Unit', 'Type', 'Expected', 'Submitted', 'Missing', 'Completion %', 'Missing Dates']],
      body: data.map(r => [
        r.facilityName, r.unitName, r.unitType,
        r.expected, r.submitted, r.missing, `${r.completionPct}%`,
        r.missingDates.join(', '),
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        3: { halign: 'center' }, 4: { halign: 'center' },
        5: { halign: 'center' }, 6: { halign: 'center' },
        7: { cellWidth: 'auto' },
      },
      didParseCell: (d) => {
        if (d.column.index === 5 && d.section === 'body') {
          const v = Number(d.cell.raw);
          if (v > 0) d.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    doc.save(`missing_days_report_${year}.pdf`);
    toast({ title: 'PDF exported', description: 'Missing days report exported.' });
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarX className="h-5 w-5" />
            Missing Days Report
          </CardTitle>
          <CardDescription>
            Year-to-date operating days with no Daily Operations entry, by facility and unit
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data?.length ? (
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
        ) : !data?.length ? (
          <p className="text-center text-muted-foreground py-8">No facilities or units configured.</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Operating Days YTD</div>
                <div className="text-2xl font-semibold">{totals.expected}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Submitted</div>
                <div className="text-2xl font-semibold text-primary">{totals.submitted}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Missing</div>
                <div className={`text-2xl font-semibold ${totals.missing > 0 ? 'text-destructive' : ''}`}>{totals.missing}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Completion</div>
                <div className="text-2xl font-semibold">
                  <Badge variant={totals.pct === 100 ? 'default' : totals.pct >= 90 ? 'secondary' : 'destructive'}>
                    {totals.pct}%
                  </Badge>
                </div>
              </div>
            </div>
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facility</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="w-20">Type</TableHead>
                    <TableHead className="w-28 text-center">Expected</TableHead>
                    <TableHead className="w-28 text-center">Submitted</TableHead>
                    <TableHead className="w-24 text-center">Missing</TableHead>
                    <TableHead className="w-28 text-center">Completion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(row => (
                    <TableRow key={`${row.facilityId}-${row.unitId}`} className={row.missing > 0 ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-medium">{row.facilityName}</TableCell>
                      <TableCell>{row.unitName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.unitType}</TableCell>
                      <TableCell className="text-center">{row.expected}</TableCell>
                      <TableCell className="text-center">{row.submitted}</TableCell>
                      <TableCell className="text-center">
                        {row.missing > 0 ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help font-medium text-destructive underline decoration-dotted">
                                {row.missing}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm max-h-80 overflow-y-auto">
                              <p className="font-medium mb-1">Missing dates ({row.missingDates.length}):</p>
                              <p className="text-xs whitespace-pre-wrap">
                                {row.missingDates.join(', ')}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={row.completionPct === 100 ? 'default' : row.completionPct >= 90 ? 'secondary' : 'destructive'}>
                          {row.completionPct}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          </>
        )}
      </CardContent>
    </Card>
  );
}