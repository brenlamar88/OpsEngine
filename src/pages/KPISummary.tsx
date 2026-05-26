import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useKPISummary } from '@/hooks/useKPISummary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Download, Loader2, BarChart3, CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function KPISummary() {
  const [facilityId, setFacilityId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const hasCustomRange = !!(dateFrom && dateTo);

  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const { data } = await supabase.from('facilities').select('id, name').eq('is_active', true).order('name');
      return data || [];
    },
  });

  const { data: units } = useQuery({
    queryKey: ['units', facilityId],
    queryFn: async () => {
      let q = supabase.from('units').select('id, name').eq('is_active', true).order('name');
      if (facilityId) q = q.eq('facility_id', facilityId);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: kpiData, isLoading } = useKPISummary(
    facilityId || undefined,
    unitId || undefined,
    hasCustomRange ? format(dateFrom!, 'yyyy-MM-dd') : undefined,
    hasCustomRange ? format(dateTo!, 'yyyy-MM-dd') : undefined
  );

  const handleExportCSV = () => {
    if (!kpiData) return;
    const headers = hasCustomRange ? ['Metric', 'Value'] : ['Metric', 'Weekly', 'MTD', 'YTD'];
    const rows = [headers, ...kpiData.map(r =>
      hasCustomRange ? [r.metric, String(r.weekly)] : [r.metric, String(r.weekly), String(r.mtd), String(r.ytd)]
    )];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kpi-summary.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearDateRange = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">KPI Summary</h1>
            <p className="text-sm text-muted-foreground">Weekly, MTD, and YTD key performance indicators</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!kpiData}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-end">
        <Select value={facilityId} onValueChange={(v) => { setFacilityId(v === 'all' ? '' : v); setUnitId(''); }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Facilities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Facilities</SelectItem>
            {facilities?.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={unitId} onValueChange={(v) => setUnitId(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Units" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Units</SelectItem>
            {units?.map(u => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-[160px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, 'MM/dd/yyyy') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={setDateFrom}
              disabled={(date) => date > new Date() || (dateTo ? date > dateTo : false)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-[160px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, 'MM/dd/yyyy') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              disabled={(date) => date > new Date() || (dateFrom ? date < dateFrom : false)}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {hasCustomRange && (
          <Button variant="ghost" size="sm" onClick={clearDateRange} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Clear dates
          </Button>
        )}
      </div>

      {/* KPI Table */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-lg">
            {hasCustomRange
              ? `Performance Metrics: ${format(dateFrom!, 'MM/dd/yyyy')} – ${format(dateTo!, 'MM/dd/yyyy')}`
              : 'Performance Metrics'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Metric</TableHead>
                  {hasCustomRange ? (
                    <TableHead className="text-right">Total</TableHead>
                  ) : (
                    <>
                      <TableHead className="text-right">Weekly</TableHead>
                      <TableHead className="text-right">MTD</TableHead>
                      <TableHead className="text-right">YTD</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiData?.map((row) => (
                  <TableRow key={row.metric}>
                    <TableCell className="font-medium">{row.metric}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.weekly}</TableCell>
                    {!hasCustomRange && (
                      <>
                        <TableCell className="text-right tabular-nums">{row.mtd}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.ytd}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
