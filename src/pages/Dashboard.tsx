import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmitsDashboard } from '@/hooks/useAdmitsDashboard';
import { useFacilityAccess } from '@/hooks/useFacilityAccess';
import { KPICard } from '@/components/dashboard/KPICard';
import { AdmitsChart } from '@/components/dashboard/AdmitsChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Link } from 'react-router-dom';
import { CalendarIcon, Building2, RefreshCw, Layers } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const { filterFacilities, shouldViewAll, assignedFacilityIds } = useFacilityAccess();
  
  // Default to current month
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [selectedFacility, setSelectedFacility] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  const facilityId = selectedFacility || null;
  const unitId = selectedUnitId || null;

  const {
    facilities: allFacilities,
    availableUnits,
    admitsData,
    metrics,
    chartData,
    loading,
  } = useAdmitsDashboard(startDate, endDate, facilityId, unitId);

  // Filter facilities based on user access
  const facilities = useMemo(
    () => filterFacilities(allFacilities),
    [allFacilities, filterFacilities]
  );

  // Default to Monroe facility when facilities are loaded
  useEffect(() => {
    if (facilities.length > 0 && !selectedFacility) {
      const monroeFacility = facilities.find(
        (f) =>
          f.name.toLowerCase().includes('monroe') ||
          f.code?.toLowerCase().includes('monroe')
      );
      if (monroeFacility) {
        setSelectedFacility(monroeFacility.id);
      } else {
        setSelectedFacility(facilities[0].id);
      }
    }
  }, [facilities, selectedFacility]);

  // Reset unit selection when facility changes
  useEffect(() => {
    setSelectedUnitId('');
  }, [selectedFacility]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const getGradeVariant = (grade: string): 'positive' | 'negative' | 'neutral' => {
    if (grade === 'A' || grade === 'B') return 'positive';
    if (grade === 'D' || grade === 'F') return 'negative';
    return 'neutral';
  };

  const getVarianceVariant = (percent: number): 'positive' | 'negative' | 'neutral' => {
    if (percent >= 91) return 'positive';
    if (percent >= 71) return 'neutral';
    return 'negative';
  };

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="animate-slide-up">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track admits performance and metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Start Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[140px] justify-start text-left font-normal',
                  !startDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'MMM d, yyyy') : 'Start'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">to</span>

          {/* End Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[140px] justify-start text-left font-normal',
                  !endDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'MMM d, yyyy') : 'End'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => date && setEndDate(date)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Select value={selectedFacility} onValueChange={setSelectedFacility}>
            <SelectTrigger className="w-[180px]">
              <Building2 className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Facility" />
            </SelectTrigger>
            <SelectContent>
              {facilities.map((facility) => (
                <SelectItem key={facility.id} value={facility.id}>
                  {facility.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={selectedUnitId || 'all'} 
            onValueChange={(v) => setSelectedUnitId(v === 'all' ? '' : v)}
            disabled={availableUnits.length === 0}
          >
            <SelectTrigger className="w-[180px]">
              <Layers className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Units" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Units</SelectItem>
              {availableUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.name} ({unit.unit_type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards - Row 1: Admits */}
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Budget Admits"
              value={admitsData.budgetAdmits.toLocaleString()}
              subtitle={`${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`}
              variant="neutral"
            />
            <KPICard
              title="Actual Admits"
              value={admitsData.actualAdmits.toLocaleString()}
              subtitle={`${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`}
              variant="neutral"
            />
            <KPICard
              title="Variance"
              value={`${admitsData.variancePercent.toFixed(1)}%`}
              subtitle={
                admitsData.budgetAdmits > 0
                  ? `${admitsData.actualAdmits} / ${admitsData.budgetAdmits} budget`
                  : 'No budget data'
              }
              variant={getVarianceVariant(admitsData.variancePercent)}
            />
            <KPICard
              title="Performance Grade"
              value={admitsData.performanceGrade}
              subtitle={
                admitsData.performanceGrade === 'A'
                  ? 'Excellent (91%+)'
                  : admitsData.performanceGrade === 'B'
                  ? 'Good (81-90%)'
                  : admitsData.performanceGrade === 'C'
                  ? 'Average (71-80%)'
                  : admitsData.performanceGrade === 'D'
                  ? 'Below Average (61-70%)'
                  : admitsData.performanceGrade === 'F'
                  ? 'Poor (0-60%)'
                  : 'No data'
              }
              variant={getGradeVariant(admitsData.performanceGrade)}
            />
          </div>

          {/* KPI Cards - Row 2: Operations */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPICard
              title="Total Referrals"
              value={metrics.totalReferrals.toLocaleString()}
              subtitle={`${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`}
              variant="neutral"
            />
            <KPICard
              title="Total Discharges"
              value={metrics.totalDischarges.toLocaleString()}
              subtitle={`${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`}
              variant="neutral"
            />
            <KPICard
              title="Avg Daily Census"
              value={metrics.avgDailyCensus.toFixed(1)}
              subtitle={`${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`}
              variant="neutral"
            />
          </div>

          <div className="mb-8">
            <Card className="border-border/70">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Program Rankings</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Compare facilities across inpatient and IOP performance.
                  </p>
                </div>
                <Button asChild>
                  <Link to="/reports/program-rankings">Open Rankings</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Review day, MTD, and YTD budget, actual, and variance rankings on a dedicated page.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Admits Chart */}
          {chartData.length > 0 && (
            <div className="mb-8">
              <AdmitsChart data={chartData} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
