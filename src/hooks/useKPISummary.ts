import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, startOfMonth, startOfYear, format, isWeekend, previousFriday } from 'date-fns';

function getDateRanges(customStart?: string, customEnd?: string) {
  const now = new Date();
  const today = isWeekend(now) ? previousFriday(now) : now;
  const todayStr = format(today, 'yyyy-MM-dd');

  if (customStart && customEnd) {
    return {
      weekly: { start: customStart, end: customEnd },
      mtd: { start: customStart, end: customEnd },
      ytd: { start: customStart, end: customEnd },
    };
  }

  return {
    weekly: { start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: todayStr },
    mtd: { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: todayStr },
    ytd: { start: format(startOfYear(today), 'yyyy-MM-dd'), end: todayStr },
  };
}

interface KPIData {
  metric: string;
  weekly: number | string;
  mtd: number | string;
  ytd: number | string;
}

async function fetchADC(
  range: { start: string; end: string },
  facilityId?: string,
  unitId?: string
) {
  let query = supabase
    .from('daily_operations')
    .select('mcr_full_days, mcr_co_days, mcr_lifetime_days, hmo_pt_days, medicaid_pt_days, commercial_pt_days, private_pay_pt_days, charity_indigent_pt_days, elmhs_pt_days, date')
    .gte('date', range.start)
    .lte('date', range.end);

  if (facilityId) query = query.eq('facility_id', facilityId);
  if (unitId) query = query.eq('unit_id', unitId);

  const { data, error } = await query;
  if (error) throw error;

  const totalDays = (data || []).reduce((sum, row) => {
    return sum +
      (row.mcr_full_days || 0) +
      (row.mcr_co_days || 0) +
      (row.mcr_lifetime_days || 0) +
      (row.hmo_pt_days || 0) +
      (row.medicaid_pt_days || 0) +
      (row.commercial_pt_days || 0) +
      (row.private_pay_pt_days || 0) +
      (row.charity_indigent_pt_days || 0) +
      (row.elmhs_pt_days || 0);
  }, 0);

  const uniqueDates = new Set((data || []).map(r => r.date));

  // Add IOP census from iop_patients (source of truth for IOP units)
  let iopQuery = supabase
    .from('iop_patients')
    .select('entry_date')
    .gte('entry_date', range.start)
    .lte('entry_date', range.end);
  if (facilityId) iopQuery = iopQuery.eq('facility_id', facilityId);
  if (unitId) iopQuery = iopQuery.eq('unit_id', unitId);
  const { data: iopData } = await iopQuery;

  let iopTotal = 0;
  (iopData || []).forEach((p: any) => {
    iopTotal += 1;
    if (p.entry_date) uniqueDates.add(p.entry_date);
  });

  const total = totalDays + iopTotal;
  return uniqueDates.size > 0 ? total / uniqueDates.size : 0;
}

async function fetchServiceMetrics(
  range: { start: string; end: string },
  facilityId?: string,
  unitId?: string
): Promise<Record<string, number>> {
  let query = supabase
    .from('service_development_entries')
    .select('metric_name, numeric_value')
    .gte('date', range.start)
    .lte('date', range.end)
    .in('metric_name', ['inquiries', 'referrals', 'admits', 'discharges']);

  if (facilityId) query = query.eq('facility_id', facilityId);
  if (unitId) query = query.eq('unit_id', unitId);

  const { data, error } = await query;
  if (error) throw error;

  const result: Record<string, number> = { inquiries: 0, referrals: 0, admits: 0, discharges: 0 };
  data?.forEach(row => {
    if (row.metric_name in result) {
      result[row.metric_name] += row.numeric_value || 0;
    }
  });
  return result;
}

export function useKPISummary(facilityId?: string, unitId?: string, dateFrom?: string, dateTo?: string) {
  const isCustomRange = !!(dateFrom && dateTo);
  return useQuery({
    queryKey: ['kpi-summary', facilityId, unitId, dateFrom, dateTo],
    queryFn: async (): Promise<KPIData[]> => {
      const ranges = getDateRanges(dateFrom, dateTo);

      if (isCustomRange) {
        const [adc, svc] = await Promise.all([
          fetchADC(ranges.weekly, facilityId, unitId),
          fetchServiceMetrics(ranges.weekly, facilityId, unitId),
        ]);

        const ratio = (refs: number, admits: number) =>
          admits > 0 ? (refs / admits).toFixed(2) : 'N/A';

        return [
          { metric: 'ADC', weekly: adc.toFixed(1), mtd: '-', ytd: '-' },
          { metric: 'Inquiries', weekly: svc.inquiries, mtd: '-', ytd: '-' },
          { metric: 'Referrals', weekly: svc.referrals, mtd: '-', ytd: '-' },
          { metric: 'Admits', weekly: svc.admits, mtd: '-', ytd: '-' },
          { metric: 'Discharges', weekly: svc.discharges, mtd: '-', ytd: '-' },
          { metric: 'Ref-Admit Ratio', weekly: ratio(svc.referrals, svc.admits), mtd: '-', ytd: '-' },
        ];
      }

      const [weeklyADC, mtdADC, ytdADC, weeklySvc, mtdSvc, ytdSvc] = await Promise.all([
        fetchADC(ranges.weekly, facilityId, unitId),
        fetchADC(ranges.mtd, facilityId, unitId),
        fetchADC(ranges.ytd, facilityId, unitId),
        fetchServiceMetrics(ranges.weekly, facilityId, unitId),
        fetchServiceMetrics(ranges.mtd, facilityId, unitId),
        fetchServiceMetrics(ranges.ytd, facilityId, unitId),
      ]);

      const ratio = (refs: number, admits: number) =>
        admits > 0 ? (refs / admits).toFixed(2) : 'N/A';

      return [
        { metric: 'ADC', weekly: weeklyADC.toFixed(1), mtd: mtdADC.toFixed(1), ytd: ytdADC.toFixed(1) },
        { metric: 'Inquiries', weekly: weeklySvc.inquiries, mtd: mtdSvc.inquiries, ytd: ytdSvc.inquiries },
        { metric: 'Referrals', weekly: weeklySvc.referrals, mtd: mtdSvc.referrals, ytd: ytdSvc.referrals },
        { metric: 'Admits', weekly: weeklySvc.admits, mtd: mtdSvc.admits, ytd: ytdSvc.admits },
        { metric: 'Discharges', weekly: weeklySvc.discharges, mtd: mtdSvc.discharges, ytd: ytdSvc.discharges },
        {
          metric: 'Ref-Admit Ratio',
          weekly: ratio(weeklySvc.referrals, weeklySvc.admits),
          mtd: ratio(mtdSvc.referrals, mtdSvc.admits),
          ytd: ratio(ytdSvc.referrals, ytdSvc.admits),
        },
      ];
    },
  });
}
