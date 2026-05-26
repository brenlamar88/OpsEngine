import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CalendarIcon, TrendingUp, TrendingDown, Users, DollarSign, Activity, AlertTriangle, MapPin, Download, FileText, Clock, ChevronDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TERRITORIES, SERVICE_DEV_METRICS, type Territory } from '@/hooks/useServiceDevelopment';
import { useFacilityAccess } from '@/hooks/useFacilityAccess';
import { 
  downloadOperationsSummaryCSV, 
  downloadOperationsSummaryPDF, 
  downloadDailyOperationsDetailCSV,
  downloadDailyOperationsDetailPDF,
  type OperationsSummaryData,
  type DailyOperationsDetailData,
} from '@/lib/export-utils';

export default function OperationsSummary() {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [facilityId, setFacilityId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('all');
  const { filterFacilities } = useFacilityAccess();

  const dateRangeLabel = `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
  const totalDays = differenceInDays(endDate, startDate) + 1;

  const { data: allFacilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const { data } = await supabase
        .from('facilities')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Filter facilities based on user access
  const facilities = useMemo(() => 
    filterFacilities(allFacilities || []), 
    [allFacilities, filterFacilities]
  );

  // Fetch units for the selected facility
  const { data: units } = useQuery({
    queryKey: ['units', facilityId],
    queryFn: async () => {
      if (!facilityId) return [];
      const { data } = await supabase
        .from('units')
        .select('id, name, unit_type')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: !!facilityId,
  });

  // Fetch budget config for all units or selected unit to get rates
  const { data: budgetConfigs } = useQuery({
    queryKey: ['unit-budget-configs', facilityId, unitId],
    queryFn: async () => {
      if (!facilityId) return [];
      
      let query = supabase
        .from('unit_budget_config')
        .select('*');
      
      if (unitId && unitId !== 'all') {
        query = query.eq('unit_id', unitId);
      } else if (units && units.length > 0) {
        // Get configs for all units of this facility
        const unitIds = units.map(u => u.id);
        query = query.in('unit_id', unitIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!facilityId && (!!unitId || (units && units.length > 0)),
  });

  // Reset unit selection when facility changes
  const handleFacilityChange = (newFacilityId: string) => {
    setFacilityId(newFacilityId);
    setUnitId('all');
  };

  const { data: dailyData, isLoading } = useQuery({
    queryKey: ['daily-operations-monthly', facilityId, unitId, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!facilityId) return [];
      let query = supabase
        .from('daily_operations')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));
      
      // Filter by unit if not "all"
      if (unitId && unitId !== 'all') {
        query = query.eq('unit_id', unitId);
      }
      
      const { data, error } = await query.order('date');
      if (error) throw error;
      return data || [];
    },
    enabled: !!facilityId,
  });

  // Fetch service development entries for the month
  const { data: serviceDevData } = useQuery({
    queryKey: ['service-development-monthly', facilityId, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!facilityId) return [];
      const { data, error } = await supabase
        .from('service_development_entries')
        .select('*')
        .eq('facility_id', facilityId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));
      if (error) throw error;
      return data || [];
    },
    enabled: !!facilityId,
  });

  // Fetch IOP patient counts by date from iop_patients table
  const { data: iopPatientCounts } = useQuery({
    queryKey: ['iop-patient-counts', facilityId, unitId, format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!facilityId) return [];
      
      let query = supabase
        .from('iop_patients')
        .select('entry_date, id')
        .eq('facility_id', facilityId)
        .gte('entry_date', format(startDate, 'yyyy-MM-dd'))
        .lte('entry_date', format(endDate, 'yyyy-MM-dd'));
      
      if (unitId && unitId !== 'all') {
        query = query.eq('unit_id', unitId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Group by entry_date and count patients
      const countsByDate: Record<string, number> = {};
      (data || []).forEach((patient: any) => {
        const date = patient.entry_date;
        countsByDate[date] = (countsByDate[date] || 0) + 1;
      });
      
      return countsByDate;
    },
    enabled: !!facilityId,
  });

  // Aggregate service development by territory
  const territoryAggregates = useMemo(() => {
    if (!serviceDevData || serviceDevData.length === 0) return null;

    const result: Record<Territory, Record<string, number>> = {
      Red: {},
      White: {},
      Blue: {},
    };

    // Initialize all metrics to 0
    TERRITORIES.forEach(territory => {
      SERVICE_DEV_METRICS.forEach(metric => {
        if (metric.type === 'number') {
          result[territory][metric.key] = 0;
        }
      });
    });

    // Sum up values by territory
    serviceDevData.forEach((entry: any) => {
      const territory = entry.territory as Territory;
      const metricKey = entry.metric_name;
      if (result[territory] && metricKey) {
        const metric = SERVICE_DEV_METRICS.find(m => m.key === metricKey);
        if (metric && metric.type === 'number') {
          result[territory][metricKey] = (result[territory][metricKey] || 0) + Number(entry.numeric_value || 0);
        }
      }
    });

    return result;
  }, [serviceDevData]);

  // Calculate totals across all territories
  const serviceTotals = useMemo(() => {
    if (!territoryAggregates) return { admits: 0, discharges: 0, inquiries: 0, referrals: 0 };

    const totals = {
      admits: 0,
      discharges: 0,
      inquiries: 0,
      referrals: 0,
    };

    TERRITORIES.forEach(territory => {
      totals.admits += territoryAggregates[territory]?.admits || 0;
      totals.discharges += territoryAggregates[territory]?.discharges || 0;
      totals.inquiries += territoryAggregates[territory]?.inquiries || 0;
      totals.referrals += territoryAggregates[territory]?.referrals || 0;
    });

    return totals;
  }, [territoryAggregates]);

  // Calculate aggregated budget rates from config(s)
  const avgBudgetRates = useMemo(() => {
    const defaultRates = {
      rateMcrFullDays: 955,
      rateMcrCoDays: 536,
      rateMcrLifetimeDays: 117,
      rateHmo: 900,
      rateMedicaid: 737,
      rateCommercial: 800,
      ratePrivatePay: 800,
      rateCharityIndigent: 0,
    };

    if (!budgetConfigs || budgetConfigs.length === 0) {
      return defaultRates;
    }

    // Average the rates across all configs
    const sum = budgetConfigs.reduce((acc, config) => ({
      rateMcrFullDays: acc.rateMcrFullDays + Number(config.rate_mcr_full_days || 0),
      rateMcrCoDays: acc.rateMcrCoDays + Number(config.rate_mcr_co_days || 0),
      rateMcrLifetimeDays: acc.rateMcrLifetimeDays + Number(config.rate_mcr_lifetime_days || 0),
      rateHmo: acc.rateHmo + Number(config.rate_hmo || 0),
      rateMedicaid: acc.rateMedicaid + Number(config.rate_medicaid || 0),
      rateCommercial: acc.rateCommercial + Number(config.rate_commercial || 0),
      ratePrivatePay: acc.ratePrivatePay + Number(config.rate_private_pay || 0),
      rateCharityIndigent: acc.rateCharityIndigent + Number(config.rate_charity_indigent || 0),
    }), {
      rateMcrFullDays: 0,
      rateMcrCoDays: 0,
      rateMcrLifetimeDays: 0,
      rateHmo: 0,
      rateMedicaid: 0,
      rateCommercial: 0,
      ratePrivatePay: 0,
      rateCharityIndigent: 0,
    });

    const count = budgetConfigs.length;
    return {
      rateMcrFullDays: sum.rateMcrFullDays / count,
      rateMcrCoDays: sum.rateMcrCoDays / count,
      rateMcrLifetimeDays: sum.rateMcrLifetimeDays / count,
      rateHmo: sum.rateHmo / count,
      rateMedicaid: sum.rateMedicaid / count,
      rateCommercial: sum.rateCommercial / count,
      ratePrivatePay: sum.ratePrivatePay / count,
      rateCharityIndigent: sum.rateCharityIndigent / count,
    };
  }, [budgetConfigs]);

  // Aggregate monthly totals (now using service development for admits/discharges)
  const aggregates = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return null;

    const totals = dailyData.reduce((acc, day) => {
      // Census days breakdown
      const mcrFullDays = Number(day.mcr_full_days || 0);
      const mcrCoDays = Number(day.mcr_co_days || 0);
      const mcrLifetimeDays = Number(day.mcr_lifetime_days || 0);
      const hmoDays = Number(day.hmo_pt_days || 0);
      const medicaidDays = Number(day.medicaid_pt_days || 0);
      const commercialDays = Number(day.commercial_pt_days || 0);
      const privatePayDays = Number(day.private_pay_pt_days || 0);
      const charityDays = Number(day.charity_indigent_pt_days || 0);

      return {
        // Census
        totalCensus: acc.totalCensus + mcrFullDays + mcrCoDays + mcrLifetimeDays + hmoDays + medicaidDays + commercialDays + privatePayDays + charityDays,
        mcrFullDays: acc.mcrFullDays + mcrFullDays,
        mcrCoDays: acc.mcrCoDays + mcrCoDays,
        mcrLifetimeDays: acc.mcrLifetimeDays + mcrLifetimeDays,
        mcrDays: acc.mcrDays + mcrFullDays + mcrCoDays + mcrLifetimeDays,
        hmoDays: acc.hmoDays + hmoDays,
        medicaidDays: acc.medicaidDays + medicaidDays,
        commercialDays: acc.commercialDays + commercialDays,
        privatePayDays: acc.privatePayDays + privatePayDays,
        charityDays: acc.charityDays + charityDays,
        // Deposits
        totalDeposits: acc.totalDeposits + Number(day.total_deposits || 0),
        // Quality
        falls: acc.falls + Number(day.falls_with_injury || 0) + Number(day.falls_without_injury || 0),
        incidents: acc.incidents + Number(day.incident_report_with_injury || 0) + Number(day.incident_report_without_injury || 0),
        complaints: acc.complaints + Number(day.complaints || 0) + Number(day.grievances || 0),
        restraints: acc.restraints + Number(day.restraints || 0) + Number(day.seclusions || 0),
        // Staffing
        totalPayroll: acc.totalPayroll + Number(day.total_payroll || 0),
        employeesHired: acc.employeesHired + Number(day.employees_hired || 0),
        employeesTermed: acc.employeesTermed + Number(day.employees_termed || 0),
        // Projected
        projectedRevenue: acc.projectedRevenue + Number(day.projected_daily_revenue || 0),
        projectedExpense: acc.projectedExpense + Number(day.projected_daily_expense || 0),
      };
    }, {
      totalCensus: 0, mcrFullDays: 0, mcrCoDays: 0, mcrLifetimeDays: 0, mcrDays: 0, hmoDays: 0, medicaidDays: 0, commercialDays: 0, privatePayDays: 0, charityDays: 0,
      totalDeposits: 0,
      falls: 0, incidents: 0, complaints: 0, restraints: 0,
      totalPayroll: 0, employeesHired: 0, employeesTermed: 0,
      projectedRevenue: 0, projectedExpense: 0,
    });

    // Add IOP patient counts to census (source of truth for IOP units)
    const iopCensusByDate = iopPatientCounts || {};
    const iopCensusTotal = Object.values(iopCensusByDate).reduce(
      (sum: number, v) => sum + Number(v || 0),
      0,
    );
    const iopDaysWithEntries = Object.keys(iopCensusByDate).length;
    totals.totalCensus += iopCensusTotal;

    // Use the larger of inpatient daily_operations rows or IOP entry days as the day basis
    const censusDayBasis = Math.max(dailyData.length, iopDaysWithEntries) || 1;

    // Calculate revenue as days × budget rates
    const mcrFullRevenue = totals.mcrFullDays * avgBudgetRates.rateMcrFullDays;
    const mcrCoRevenue = totals.mcrCoDays * avgBudgetRates.rateMcrCoDays;
    const mcrLifetimeRevenue = totals.mcrLifetimeDays * avgBudgetRates.rateMcrLifetimeDays;
    const mcrRevenue = mcrFullRevenue + mcrCoRevenue + mcrLifetimeRevenue;
    const hmoRevenue = totals.hmoDays * avgBudgetRates.rateHmo;
    const medicaidRevenue = totals.medicaidDays * avgBudgetRates.rateMedicaid;
    const commercialRevenue = totals.commercialDays * avgBudgetRates.rateCommercial;
    const privatePayRevenue = totals.privatePayDays * avgBudgetRates.ratePrivatePay;
    const charityRevenue = totals.charityDays * avgBudgetRates.rateCharityIndigent;
    const totalRevenue = mcrRevenue + hmoRevenue + medicaidRevenue + commercialRevenue + privatePayRevenue + charityRevenue;

    return {
      ...totals,
      // Revenue calculated from days × rates
      totalRevenue,
      mcrRevenue,
      hmoRevenue,
      medicaidRevenue,
      commercialRevenue,
      privatePayRevenue,
      charityRevenue,
      // Use service development data for admits/discharges
      admits: serviceTotals.admits,
      discharges: serviceTotals.discharges,
      inquiries: serviceTotals.inquiries,
      referrals: serviceTotals.referrals,
      daysEntered: dailyData.length,
      avgDailyCensus: totals.totalCensus / censusDayBasis,
      avgDailyRevenue: totalRevenue / dailyData.length,
      avgPPD: totals.totalCensus > 0 ? totalRevenue / totals.totalCensus : 0,
      projectedProfitLoss: totals.projectedRevenue - totals.projectedExpense,
      // ALOS = Total Patient Days / Total Discharges
      alos: serviceTotals.discharges > 0 ? totals.totalCensus / serviceTotals.discharges : 0,
    };
  }, [dailyData, serviceTotals, avgBudgetRates, iopPatientCounts]);

  // Chart data for census trend
  const censusTrendData = useMemo(() => {
    if (!dailyData) return [];
    return dailyData.map(day => ({
      date: format(new Date(day.date), 'MMM d'),
      MCR: Number(day.mcr_full_days || 0) + Number(day.mcr_co_days || 0) + Number(day.mcr_lifetime_days || 0),
      HMO: Number(day.hmo_pt_days || 0),
      Medicaid: Number(day.medicaid_pt_days || 0),
      Commercial: Number(day.commercial_pt_days || 0),
      total: Number(day.mcr_full_days || 0) + Number(day.mcr_co_days || 0) + Number(day.mcr_lifetime_days || 0) +
        Number(day.hmo_pt_days || 0) + Number(day.medicaid_pt_days || 0) + Number(day.commercial_pt_days || 0) +
        Number(day.private_pay_pt_days || 0) + Number(day.charity_indigent_pt_days || 0),
    }));
  }, [dailyData]);

  // Chart data for revenue trend - calculate daily revenue as days × budget rates
  const revenueTrendData = useMemo(() => {
    if (!dailyData) return [];
    return dailyData.map(day => {
      const mcrFullDays = Number(day.mcr_full_days || 0);
      const mcrCoDays = Number(day.mcr_co_days || 0);
      const mcrLifetimeDays = Number(day.mcr_lifetime_days || 0);
      const hmoDays = Number(day.hmo_pt_days || 0);
      const medicaidDays = Number(day.medicaid_pt_days || 0);
      const commercialDays = Number(day.commercial_pt_days || 0);
      const privatePayDays = Number(day.private_pay_pt_days || 0);
      const charityDays = Number(day.charity_indigent_pt_days || 0);

      const dailyRevenue = 
        (mcrFullDays * avgBudgetRates.rateMcrFullDays) +
        (mcrCoDays * avgBudgetRates.rateMcrCoDays) +
        (mcrLifetimeDays * avgBudgetRates.rateMcrLifetimeDays) +
        (hmoDays * avgBudgetRates.rateHmo) +
        (medicaidDays * avgBudgetRates.rateMedicaid) +
        (commercialDays * avgBudgetRates.rateCommercial) +
        (privatePayDays * avgBudgetRates.ratePrivatePay) +
        (charityDays * avgBudgetRates.rateCharityIndigent);

      return {
        date: format(new Date(day.date), 'MMM d'),
        revenue: dailyRevenue,
        deposits: Number(day.total_deposits || 0),
      };
    });
  }, [dailyData, avgBudgetRates]);

  // Chart data for payer mix
  const payerMixData = useMemo(() => {
    if (!aggregates) return [];
    return [
      { name: 'MCR', days: aggregates.mcrDays, revenue: aggregates.mcrRevenue },
      { name: 'HMO', days: aggregates.hmoDays, revenue: aggregates.hmoRevenue },
      { name: 'Medicaid', days: aggregates.medicaidDays, revenue: aggregates.medicaidRevenue },
      { name: 'Commercial', days: aggregates.commercialDays, revenue: aggregates.commercialRevenue },
    ];
  }, [aggregates]);

  const selectedFacility = facilities?.find(f => f.id === facilityId);

  const handleExport = (type: 'csv' | 'pdf') => {
    if (!aggregates || !selectedFacility || !territoryAggregates) return;

    const selectedUnit = units?.find(u => u.id === unitId);
    const unitLabel = unitId === 'all' ? 'All Units' : selectedUnit ? `${selectedUnit.name} (${selectedUnit.unit_type})` : undefined;

    const exportData: OperationsSummaryData = {
      facilityName: selectedFacility.name,
      unitName: unitLabel,
      dateRange: dateRangeLabel,
      generatedAt: format(new Date(), 'MMM d, yyyy h:mm a'),
      kpis: {
        totalCensus: aggregates.totalCensus,
        avgDailyCensus: aggregates.avgDailyCensus,
        totalRevenue: aggregates.totalRevenue,
        avgDailyRevenue: aggregates.avgDailyRevenue,
        avgPPD: aggregates.avgPPD,
        alos: aggregates.alos,
        admits: aggregates.admits,
        discharges: aggregates.discharges,
        inquiries: aggregates.inquiries,
        referrals: aggregates.referrals,
        falls: aggregates.falls,
        incidents: aggregates.incidents,
        complaints: aggregates.complaints,
        restraints: aggregates.restraints,
        totalPayroll: aggregates.totalPayroll,
        employeesHired: aggregates.employeesHired,
        employeesTermed: aggregates.employeesTermed,
        projectedProfitLoss: aggregates.projectedProfitLoss,
        daysEntered: aggregates.daysEntered,
      },
      censusByPayer: {
        mcrDays: aggregates.mcrDays,
        hmoDays: aggregates.hmoDays,
        medicaidDays: aggregates.medicaidDays,
        commercialDays: aggregates.commercialDays,
        privatePayDays: aggregates.privatePayDays,
        charityDays: aggregates.charityDays,
      },
      revenueByPayer: {
        mcrRevenue: aggregates.mcrRevenue,
        hmoRevenue: aggregates.hmoRevenue,
        medicaidRevenue: aggregates.medicaidRevenue,
        commercialRevenue: aggregates.commercialRevenue,
        privatePayRevenue: aggregates.privatePayRevenue,
        charityRevenue: aggregates.charityRevenue,
      },
      territories: TERRITORIES.map(territory => {
        const data = territoryAggregates[territory];
        return {
          name: territory,
          inquiries: data?.inquiries || 0,
          referrals: data?.referrals || 0,
          admits: data?.admits || 0,
          discharges: data?.discharges || 0,
          faceToFace: data?.face_to_face_touches || 0,
          qualityTouches: data?.quality_touches || 0,
          fiveStarSurveys: data?.five_star_surveys || 0,
        };
      }),
    };

    const unitSuffix = unitId !== 'all' && selectedUnit ? `-${selectedUnit.name}` : '';
    const filename = `operations-summary-${selectedFacility.code}${unitSuffix}-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}`;
    
    if (type === 'csv') {
      downloadOperationsSummaryCSV(exportData, `${filename}.csv`);
    } else {
      downloadOperationsSummaryPDF(exportData, `${filename}.pdf`);
    }
  };

  const handleDetailExport = (type: 'csv' | 'pdf') => {
    if (!dailyData || !selectedFacility || dailyData.length === 0) return;

    const selectedUnit = units?.find(u => u.id === unitId);
    const unitLabel = unitId === 'all' ? 'All Units' : selectedUnit ? `${selectedUnit.name} (${selectedUnit.unit_type})` : undefined;
    const unitType = selectedUnit?.unit_type;

    const detailData: DailyOperationsDetailData = {
      facilityName: selectedFacility.name,
      unitName: unitLabel,
      unitType: unitType,
      dateRange: dateRangeLabel,
      generatedAt: format(new Date(), 'MMM d, yyyy h:mm a'),
      rates: {
        mcrFullDays: avgBudgetRates.rateMcrFullDays,
        mcrCoDays: avgBudgetRates.rateMcrCoDays,
        mcrLifetimeDays: avgBudgetRates.rateMcrLifetimeDays,
        hmo: avgBudgetRates.rateHmo,
        medicaid: avgBudgetRates.rateMedicaid,
        commercial: avgBudgetRates.rateCommercial,
        privatePay: avgBudgetRates.ratePrivatePay,
        charityIndigent: avgBudgetRates.rateCharityIndigent,
        elmhs: 0, // ELMHS rate - adjust if you have this in budget config
      },
      entries: dailyData.map(day => {
        const mcrFullDays = Number(day.mcr_full_days || 0);
        const mcrCoDays = Number(day.mcr_co_days || 0);
        const mcrLifetimeDays = Number(day.mcr_lifetime_days || 0);
        const hmoPtDays = Number(day.hmo_pt_days || 0);
        const medicaidPtDays = Number(day.medicaid_pt_days || 0);
        const commercialPtDays = Number(day.commercial_pt_days || 0);
        const privatePayPtDays = Number(day.private_pay_pt_days || 0);
        const charityPtDays = Number(day.charity_indigent_pt_days || 0);
        const elmhsPtDays = Number(day.elmhs_pt_days || 0);

        const totalCensus = mcrFullDays + mcrCoDays + mcrLifetimeDays + hmoPtDays + 
          medicaidPtDays + commercialPtDays + privatePayPtDays + charityPtDays + elmhsPtDays;

        const totalRevenue = 
          (mcrFullDays * avgBudgetRates.rateMcrFullDays) +
          (mcrCoDays * avgBudgetRates.rateMcrCoDays) +
          (mcrLifetimeDays * avgBudgetRates.rateMcrLifetimeDays) +
          (hmoPtDays * avgBudgetRates.rateHmo) +
          (medicaidPtDays * avgBudgetRates.rateMedicaid) +
          (commercialPtDays * avgBudgetRates.rateCommercial) +
          (privatePayPtDays * avgBudgetRates.ratePrivatePay) +
          (charityPtDays * avgBudgetRates.rateCharityIndigent);

        return {
          date: format(new Date(day.date), 'yyyy-MM-dd'),
          mcrFullDays,
          mcrCoDays,
          mcrLifetimeDays,
          hmoPtDays,
          medicaidPtDays,
          commercialPtDays,
          privatePayPtDays,
          charityPtDays,
          elmhsPtDays,
          totalCensus,
          totalRevenue,
          // IOP-specific fields - get patient count from iop_patients table
          iopEnrolledTotal: iopPatientCounts?.[day.date] || 0,
          iopAttendanceTotal: Number(day.iop_daily_attendance_total || 0),
          iopGroupsBilled: Number(day.iop_daily_groups_billed || 0),
          rnHours: Number(day.rns_hours || 0),
          lpnHours: Number(day.lpns_hours || 0),
          mhtHours: Number(day.mhts_hours || 0),
          totalPayroll: Number(day.total_payroll || 0),
          fallsWithInjury: Number(day.falls_with_injury || 0),
          fallsWithoutInjury: Number(day.falls_without_injury || 0),
          incidentsWithInjury: Number(day.incident_report_with_injury || 0),
          incidentsWithoutInjury: Number(day.incident_report_without_injury || 0),
          complaints: Number(day.complaints || 0),
          grievances: Number(day.grievances || 0),
          censusComments: String(day.comments_census || ''),
          qualityComments: String(day.comments_quality_risk || ''),
        };
      }),
    };

    const unitSuffix = unitId !== 'all' && selectedUnit ? `-${selectedUnit.name}` : '';
    const filename = `daily-operations-detail-${selectedFacility.code}${unitSuffix}-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}`;
    
    if (type === 'csv') {
      downloadDailyOperationsDetailCSV(detailData, `${filename}.csv`);
    } else {
      downloadDailyOperationsDetailPDF(detailData, `${filename}.pdf`);
    }
  };

  const KPICard = ({ title, value, subValue, icon: Icon, trend, className }: {
    title: string;
    value: string | number;
    subValue?: string;
    icon: React.ElementType;
    trend?: 'up' | 'down' | 'neutral';
    className?: string;
  }) => (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
          </div>
          <div className={cn(
            "p-2 rounded-lg",
            trend === 'up' && "bg-green-500/10 text-green-600",
            trend === 'down' && "bg-red-500/10 text-red-600",
            !trend && "bg-primary/10 text-primary"
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Operations Summary</h1>
          <p className="text-sm text-muted-foreground">
            {dateRangeLabel} ({totalDays} days)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={facilityId} onValueChange={handleFacilityChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Facility" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              {facilities?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={unitId} onValueChange={setUnitId} disabled={!facilityId}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select Unit" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Units</SelectItem>
              {units?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} ({u.unit_type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[160px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(startDate, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar 
                mode="single" 
                selected={startDate} 
                onSelect={(d) => {
                  if (d) {
                    setStartDate(d);
                    if (d > endDate) {
                      setEndDate(d);
                    }
                  }
                }}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[160px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(endDate, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar 
                mode="single" 
                selected={endDate} 
                onSelect={(d) => {
                  if (d) {
                    setEndDate(d);
                    if (d < startDate) {
                      setStartDate(d);
                    }
                  }
                }}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {aggregates && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Summary (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Summary (PDF)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleDetailExport('csv')}>
                  <Download className="h-4 w-4 mr-2" />
                  Daily Detail (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDetailExport('pdf')}>
                  <Download className="h-4 w-4 mr-2" />
                  Daily Detail (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {!facilityId ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Select a facility to view the monthly summary</p>
        </Card>
      ) : isLoading ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Loading data...</p>
        </Card>
      ) : !aggregates ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No data available for the selected date range</p>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <KPICard 
              title="Total Census" 
              value={aggregates.totalCensus.toLocaleString()} 
              subValue={`${aggregates.avgDailyCensus.toFixed(1)} avg/day`}
              icon={Users}
            />
            <KPICard 
              title="Total Revenue" 
              value={`$${(aggregates.totalRevenue / 1000).toFixed(0)}K`}
              subValue={`$${aggregates.avgDailyRevenue.toFixed(0)}/day`}
              icon={DollarSign}
              trend="up"
            />
            <KPICard 
              title="Avg PPD" 
              value={`$${aggregates.avgPPD.toFixed(2)}`}
              icon={TrendingUp}
            />
            <KPICard 
              title="ALOS" 
              value={aggregates.alos.toFixed(1)}
              subValue="days avg stay"
              icon={Clock}
            />
            <KPICard 
              title="Admits / D/C" 
              value={`${aggregates.admits} / ${aggregates.discharges}`}
              subValue={`Net: ${aggregates.admits - aggregates.discharges}`}
              icon={Activity}
              trend={aggregates.admits >= aggregates.discharges ? 'up' : 'down'}
            />
            <KPICard 
              title="Quality Events" 
              value={aggregates.falls + aggregates.incidents}
              subValue={`${aggregates.falls} falls, ${aggregates.incidents} incidents`}
              icon={AlertTriangle}
              trend={aggregates.falls + aggregates.incidents > 10 ? 'down' : 'neutral'}
            />
            <KPICard 
              title="Projected P/L" 
              value={`$${(aggregates.projectedProfitLoss / 1000).toFixed(0)}K`}
              icon={aggregates.projectedProfitLoss >= 0 ? TrendingUp : TrendingDown}
              trend={aggregates.projectedProfitLoss >= 0 ? 'up' : 'down'}
            />
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold">Daily Census Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={censusTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="MCR" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="HMO" stroke="#10b981" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="Medicaid" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold">Daily Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={revenueTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="deposits" name="Deposits" stroke="#10b981" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold">Payer Mix - Patient Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payerMixData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="days" name="Patient Days" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold">Payer Mix - Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payerMixData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                      <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="py-3 bg-blue-500/10">
                <CardTitle className="text-sm font-semibold">Census Summary</CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">MCR Days</span>
                  <span className="font-mono">{aggregates.mcrDays.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">HMO Days</span>
                  <span className="font-mono">{aggregates.hmoDays.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Medicaid Days</span>
                  <span className="font-mono">{aggregates.medicaidDays.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Commercial Days</span>
                  <span className="font-mono">{aggregates.commercialDays.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total</span>
                  <span className="font-mono">{aggregates.totalCensus.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 bg-green-500/10">
                <CardTitle className="text-sm font-semibold">Revenue Summary</CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">MCR Revenue</span>
                  <span className="font-mono">${aggregates.mcrRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">HMO Revenue</span>
                  <span className="font-mono">${aggregates.hmoRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Medicaid Revenue</span>
                  <span className="font-mono">${aggregates.medicaidRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Commercial Revenue</span>
                  <span className="font-mono">${aggregates.commercialRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Total</span>
                  <span className="font-mono">${aggregates.totalRevenue.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 bg-yellow-500/10">
                <CardTitle className="text-sm font-semibold">Service Development (Total)</CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Inquiries</span>
                  <span className="font-mono">{aggregates.inquiries}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Referrals</span>
                  <span className="font-mono">{aggregates.referrals}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Admits</span>
                  <span className="font-mono">{aggregates.admits}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discharges</span>
                  <span className="font-mono">{aggregates.discharges}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t pt-2">
                  <span>Net Change</span>
                  <span className={cn("font-mono", aggregates.admits - aggregates.discharges >= 0 ? "text-green-600" : "text-red-600")}>
                    {aggregates.admits - aggregates.discharges >= 0 ? '+' : ''}{aggregates.admits - aggregates.discharges}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3 bg-red-500/10">
                <CardTitle className="text-sm font-semibold">Quality & Staffing</CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Falls</span>
                  <span className="font-mono">{aggregates.falls}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Incidents</span>
                  <span className="font-mono">{aggregates.incidents}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Complaints/Grievances</span>
                  <span className="font-mono">{aggregates.complaints}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Hired / Termed</span>
                  <span className="font-mono">{aggregates.employeesHired} / {aggregates.employeesTermed}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total Payroll</span>
                  <span className="font-mono">${aggregates.totalPayroll.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Territory Breakdown */}
          {territoryAggregates && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {TERRITORIES.map(territory => {
                const territoryData = territoryAggregates[territory];
                const admits = territoryData?.admits || 0;
                const discharges = territoryData?.discharges || 0;
                const netChange = admits - discharges;
                const territoryColor = territory === 'Red' ? 'bg-red-500/10' : territory === 'Blue' ? 'bg-blue-500/10' : 'bg-gray-500/10';
                
                return (
                  <Card key={territory}>
                    <CardHeader className={cn("py-3", territoryColor)}>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <MapPin className={cn(
                          "h-4 w-4",
                          territory === 'Red' && "text-red-600",
                          territory === 'Blue' && "text-blue-600",
                          territory === 'White' && "text-gray-600"
                        )} />
                        {territory} Territory
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Inquiries</span>
                        <span className="font-mono">{territoryData?.inquiries || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Referrals</span>
                        <span className="font-mono">{territoryData?.referrals || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Admits</span>
                        <span className="font-mono">{admits}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">D/C's</span>
                        <span className="font-mono">{discharges}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Face-to-Face</span>
                        <span className="font-mono">{territoryData?.face_to_face_touches || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quality Touches</span>
                        <span className="font-mono">{territoryData?.quality_touches || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">5 STAR Surveys</span>
                        <span className="font-mono">{territoryData?.five_star_surveys || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold border-t pt-2">
                        <span>Net Change</span>
                        <span className={cn("font-mono", netChange >= 0 ? "text-green-600" : "text-red-600")}>
                          {netChange >= 0 ? '+' : ''}{netChange}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-4 text-sm text-muted-foreground text-center">
            Based on {aggregates.daysEntered} days of data entered ({dateRangeLabel})
          </div>
        </>
      )}
    </div>
  );
}
