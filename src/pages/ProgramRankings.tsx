import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, ChevronRight, Mail, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { useProgramRankings, type ProgramRankingRow } from '@/hooks/useProgramRankings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

function formatMetric(value: number) {
  return value.toFixed(2);
}

function varianceClassName(value: number) {
  if (value > 0) return 'variance-positive';
  if (value < 0) return 'variance-negative';
  return 'text-muted-foreground';
}

// Row tint thresholds based on Day Variance:
//   >= 0.00       -> green
//   < 0 and >= -1 -> yellow
//   < -1          -> red
function varianceRowClassName(value: number) {
  if (value >= 0) return 'bg-[hsl(var(--positive)/0.12)] hover:bg-[hsl(var(--positive)/0.18)]';
  if (value >= -1) return 'bg-[hsl(var(--warning)/0.15)] hover:bg-[hsl(var(--warning)/0.22)]';
  return 'bg-[hsl(var(--negative)/0.12)] hover:bg-[hsl(var(--negative)/0.18)]';
}

function RankingsTable({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: ProgramRankingRow[];
}) {
  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="space-y-2 border-b bg-muted/20">
        <CardTitle className="text-xl text-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[64px]">Rank</TableHead>
              <TableHead className="min-w-[180px]">HOSP</TableHead>
              <TableHead className="min-w-[180px]">Unit</TableHead>
              <TableHead className="min-w-[120px] text-right">Day Budget</TableHead>
              <TableHead className="min-w-[120px] text-right">Day Actual</TableHead>
              <TableHead className="min-w-[120px] text-right">Day Variance</TableHead>
              <TableHead className="min-w-[120px] text-right">MTD Budget</TableHead>
              <TableHead className="min-w-[120px] text-right">MTD Actual</TableHead>
              <TableHead className="min-w-[120px] text-right">MTD Variance</TableHead>
              <TableHead className="min-w-[120px] text-right">YTD Budget</TableHead>
              <TableHead className="min-w-[120px] text-right">YTD Actual</TableHead>
              <TableHead className="min-w-[120px] text-right">YTD Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                  No ranking data available.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.unitId} className={varianceRowClassName(row.daily.variance)}>
                  <TableCell className="font-semibold text-foreground">#{row.rank}</TableCell>
                  <TableCell className="font-medium text-foreground">{row.facilityName}</TableCell>
                  <TableCell className="text-foreground">{row.unitName}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMetric(row.daily.budget)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMetric(row.daily.actual)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums font-medium', varianceClassName(row.daily.variance))}>
                    {formatMetric(row.daily.variance)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMetric(row.mtd.budget)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMetric(row.mtd.actual)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums font-medium', varianceClassName(row.mtd.variance))}>
                    {formatMetric(row.mtd.variance)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMetric(row.ytd.budget)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMetric(row.ytd.actual)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums font-medium', varianceClassName(row.ytd.variance))}>
                    {formatMetric(row.ytd.variance)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function ProgramRankings() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isSendingReport, setIsSendingReport] = useState(false);
  const rankingsDate = useMemo(() => selectedDate, [selectedDate]);
  const { data, isLoading } = useProgramRankings(rankingsDate);
  const { toast } = useToast();

  const handleEmailReport = async () => {
    setIsSendingReport(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error('You must be signed in to email this report.');

      const { data: refreshedSessionData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;

      const accessToken = refreshedSessionData.session?.access_token ?? sessionData.session.access_token;
      if (!accessToken) throw new Error('Unable to validate your session. Please sign in again.');

      const { data: response, error } = await supabase.functions.invoke('send-program-rankings-report', {
        body: {
          date: format(rankingsDate, 'yyyy-MM-dd'),
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) throw error;

      toast({
        title: 'Report emailed',
        description: response?.message || 'Program Rankings report sent to your email.',
      });
    } catch (error) {
      toast({
        title: 'Email failed',
        description: error instanceof Error ? error.message : 'Unable to send the Program Rankings report.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingReport(false);
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            Dashboard
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">Program Rankings</span>
          </Link>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Program Rankings</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Unit rankings for inpatient programs and IOP units with facility context across daily, month-to-date, and year-to-date performance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleEmailReport} disabled={isSendingReport}>
            <Mail className="mr-2 h-4 w-4" />
            {isSendingReport ? 'Sending...' : 'Email Report'}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[180px] justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(rankingsDate, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) => date > new Date()}
                initialFocus
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-[340px] w-full rounded-lg" />
          <Skeleton className="h-[340px] w-full rounded-lg" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">As of</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{format(data?.asOfDate ?? rankingsDate, 'MMMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inpatient Units Ranked</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{data?.inpatientRankings.length ?? 0}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">IOP Units Ranked</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{data?.iopRankings.length ?? 0}</p>
              </div>
            </CardContent>
          </Card>

          <RankingsTable
            title="Inpatient Program Rankings"
            description="Ranked by strongest variance across all inpatient units."
            rows={data?.inpatientRankings ?? []}
          />

          <RankingsTable
            title="Intensive Outpatient Unit Rankings"
            description="Ranked across all IOP units using enrollment and budget performance."
            rows={data?.iopRankings ?? []}
          />
        </div>
      )}
    </div>
  );
}