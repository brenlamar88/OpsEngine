import { useState, useMemo } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, Save, Send, Loader2, Copy, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDailyOperations, DailyOperationsData } from '@/hooks/useDailyOperations';
import { useServiceDevelopment } from '@/hooks/useServiceDevelopment';
import { useUnitBudgetConfig } from '@/hooks/useUnitBudgetConfig';
import { useFacilityAccess } from '@/hooks/useFacilityAccess';
import { ServiceDevelopmentSection } from '@/components/daily-operations/ServiceDevelopmentSection';
import { IOPPatientCard } from '@/components/daily-operations/IOPPatientCard';
import { useAuth } from '@/contexts/AuthContext';
import { DailyOpsImportDialog } from '@/components/daily-operations/DailyOpsImportDialog';

const YesNoToggle = ({ label, value, onChange }: { 
  label: string; 
  value: boolean; 
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-2 py-1.5">
    <Label className="text-sm flex-1">{label}</Label>
    <div className="flex items-center gap-2 w-28 justify-end">
      <span className={`text-xs font-medium ${!value ? 'text-foreground' : 'text-muted-foreground'}`}>No</span>
      <Switch checked={value} onCheckedChange={onChange} />
      <span className={`text-xs font-medium ${value ? 'text-foreground' : 'text-muted-foreground'}`}>Yes</span>
    </div>
  </div>
);

const NumberInput = ({ label, value, onChange, prefix, className = '', useDropdown = false, max = 100 }: { 
  label: string; 
  value: number; 
  onChange: (v: number) => void;
  prefix?: string;
  className?: string;
  useDropdown?: boolean;
  max?: number;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value?.toString() || '');

  // Sync inputValue when value changes externally
  if (!isEditing && inputValue !== (value?.toString() || '') && inputValue !== '') {
    setInputValue(value?.toString() || '');
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(num);
    } else if (val === '') {
      onChange(0);
    }
  };

  const handleSelectChange = (val: string) => {
    if (val === 'custom') {
      setIsEditing(true);
      return;
    }
    const num = parseInt(val, 10);
    onChange(num);
    setInputValue(num.toString());
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (inputValue === '' || isNaN(parseFloat(inputValue))) {
      setInputValue('0');
    }
  };

  // For dropdowns without prefix (integer counts)
  if (useDropdown && !prefix && !isEditing) {
    return (
      <div className={`flex items-center justify-between gap-2 py-1.5 ${className}`}>
        <Label className="text-sm flex-1">{label}</Label>
        <div className="w-28">
          <Select value={value?.toString() || '0'} onValueChange={handleSelectChange}>
            <SelectTrigger className="h-8 text-right font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60 bg-popover">
              {Array.from({ length: max + 1 }, (_, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {i}
                </SelectItem>
              ))}
              <SelectItem value="custom">Type custom...</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-2 py-1.5 ${className}`}>
      <Label className="text-sm flex-1">{label}</Label>
      <div className="relative w-28">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>}
        <Input
          type="number"
          className={`h-8 text-right font-mono text-sm ${prefix ? 'pl-5' : ''}`}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
};

export default function DailyOperations() {
  const [date, setDate] = useState<Date>(new Date());
  const [facilityId, setFacilityId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const { toast } = useToast();
  const { isAdmin, isNursing, isServiceDevelopment, role } = useAuth();
  const { filterFacilities } = useFacilityAccess();
  
  // Limited view roles: ADON, DON, HIM, SDD - they can view/edit but have restricted card visibility
  const isLimitedViewRole = role === 'adon' || role === 'don' || role === 'him' || role === 'sdd';
  
  // Determine which sections to show based on role
  // Admin, Editor, Program Administrator see all sections (but PA doesn't see budget cards)
  // Viewer sees all but can't edit
  const showAllSections = isAdmin || role === 'editor' || role === 'program_administrator' || role === 'viewer';
  // Nursing users only see Daily Staffing and Quality Risk Events (not Service Dev, not financial sections)
  const showNursingSections = (isNursing && !isServiceDevelopment) || showAllSections;
  // Service Development users only see Service Development section
  const showServiceDevSection = isServiceDevelopment || showAllSections;
  // Limited view roles see a subset of cards (Census, Staffing, Quality)
  const showLimitedSections = isLimitedViewRole;

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

  // Get selected unit info to check if it's IOP
  const selectedUnit = units?.find(u => u.id === unitId);
  const isIOPUnit = selectedUnit?.unit_type === 'IOP';

  // Reset unit when facility changes
  const handleFacilityChange = (value: string) => {
    setFacilityId(value);
    setUnitId('');
  };

  const { 
    data, 
    updateField, 
    isLoading, 
    isSaving, 
    isCopying,
    save, 
    copyYesterday,
    hasExistingEntry 
  } = useDailyOperations(facilityId || null, unitId || null, date);

  const {
    data: serviceDevelopmentData,
    updateField: updateServiceDevField,
    isSaving: isServiceDevSaving,
    save: saveServiceDevelopment,
  } = useServiceDevelopment(facilityId || null, unitId || null, date);

  // Unit budget configuration (persisted per unit)
  const {
    config: budgetConfig,
    isLoading: isBudgetConfigLoading,
    isSaving: isBudgetConfigSaving,
    updateConfig: updateBudgetConfig,
    updateBudgetedDailyCost,
    saveConfig: saveBudgetConfig,
    getProjectedExpense,
  } = useUnitBudgetConfig(unitId || null);

  // Calculate revenues based on census days × rates (using unit budget config rates)
  const rates = budgetConfig || {
    rateMcrFullDays: 955, rateMcrCoDays: 536, rateMcrLifetimeDays: 117,
    rateHmo: 900, rateMedicaid: 737, rateCommercial: 800, ratePrivatePay: 800, rateCharityIndigent: 0, rateElmhs: 0
  };
  
  const calculatedRevenue = {
    mcrFullDaysRev: data.mcrFullDays * rates.rateMcrFullDays,
    mcrCoDaysRev: data.mcrCoDays * rates.rateMcrCoDays,
    mcrLifetimeDaysRev: data.mcrLifetimeDays * rates.rateMcrLifetimeDays,
    hmoRev: data.hmoPtDays * rates.rateHmo,
    medicaidRev: data.medicaidPtDays * rates.rateMedicaid,
    commercialRev: data.commercialPtDays * rates.rateCommercial,
    privatePayRev: data.privatePayPtDays * rates.ratePrivatePay,
    charityIndigentRev: data.charityIndigentPtDays * rates.rateCharityIndigent,
    elmhsRev: data.elmhsPtDays * rates.rateElmhs,
  };

  // Calculate totals
  const totalCensus = data.mcrFullDays + data.mcrCoDays + data.mcrLifetimeDays + data.hmoPtDays + 
    data.medicaidPtDays + data.commercialPtDays + data.privatePayPtDays + data.charityIndigentPtDays + data.elmhsPtDays;
  
  const totalRevenue = calculatedRevenue.mcrFullDaysRev + calculatedRevenue.mcrCoDaysRev + calculatedRevenue.mcrLifetimeDaysRev + 
    calculatedRevenue.hmoRev + calculatedRevenue.medicaidRev + calculatedRevenue.commercialRev + 
    calculatedRevenue.privatePayRev + calculatedRevenue.charityIndigentRev + calculatedRevenue.elmhsRev;

  const avgPpd = totalCensus > 0 ? totalRevenue / totalCensus : 0;

  // Calculate total discharges from Service Development (across all territories)
  const totalDischarges = 
    (Number(serviceDevelopmentData.Red?.discharges) || 0) + 
    (Number(serviceDevelopmentData.White?.discharges) || 0) + 
    (Number(serviceDevelopmentData.Blue?.discharges) || 0);

  // Calculate total admits from Service Development (across all territories)
  const totalAdmits = 
    (Number(serviceDevelopmentData.Red?.admits) || 0) + 
    (Number(serviceDevelopmentData.White?.admits) || 0) + 
    (Number(serviceDevelopmentData.Blue?.admits) || 0);

  // Get budgeted daily cost based on total census (using unit config)
  const budgetedDailyCost = getProjectedExpense(totalCensus);

  const handleSave = async (status: 'draft' | 'submitted') => {
    if (!facilityId || !unitId) {
      toast({ title: 'Please select a facility and unit', variant: 'destructive' });
      return;
    }

    // Validation for "Why?" fields only on submission (not drafts)
    if (status === 'submitted') {
      // Check if late entries require explanation
      const hasLateEntries = data.lateHp > 0 || data.lateInitialTreatmentPlans > 0 || data.latePsychEvals > 0;
      if (hasLateEntries && !data.lateQualityWhy?.trim()) {
        toast({ 
          title: 'Explanation Required', 
          description: 'Please explain why there are late entries for H&P, Initial Tx Plans, or Psych Evals.',
          variant: 'destructive' 
        });
        return;
      }

      // Check if D/C surveys less than discharges requires explanation (using Service Development discharges)
      const surveysLessThanDischarges = data.internalDcSurveysExecuted < totalDischarges;
      if (surveysLessThanDischarges && !data.internalDcSurveysWhy?.trim()) {
        toast({ 
          title: 'Explanation Required', 
          description: `Please explain why # of Internal D/C Surveys Executed (${data.internalDcSurveysExecuted}) is less than Discharges (${totalDischarges}).`,
          variant: 'destructive' 
        });
        return;
      }

      // Check if Initial Cert less than Admits requires explanation
      const initialCertLessThanAdmits = data.initialCert < totalAdmits;
      if (initialCertLessThanAdmits && !data.initialCertWhy?.trim()) {
        toast({ 
          title: 'Explanation Required', 
          description: `Please explain why Initial Cert (${data.initialCert}) is less than Admits (${totalAdmits}).`,
          variant: 'destructive' 
        });
        return;
      }

      // Check if Deficiency Reports to Dept Head is "No" and requires explanation
      if (!data.deficiencyReportsToDeptHead && !data.deficiencyReportsWhy?.trim()) {
        toast({ 
          title: 'Explanation Required', 
          description: 'Please explain why Deficiency Reports were not sent to Dept Head.',
          variant: 'destructive' 
        });
        return;
      }
    }

    // Save both daily operations and service development data
    await Promise.all([
      save(status),
      saveServiceDevelopment(),
    ]);
  };

  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const handleCopyYesterday = () => {
    if (!facilityId || !unitId) {
      toast({ title: 'Please select a facility and unit first', variant: 'destructive' });
      return;
    }
    setShowCopyConfirm(true);
  };

  const confirmCopyYesterday = () => {
    copyYesterday();
    setShowCopyConfirm(false);
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 md:mb-6 space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Daily Operations Entry</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Enter daily operational data for {format(date, 'MMMM d, yyyy')}
          </p>
        </div>
        
        {/* Filter Controls - Stack on mobile */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
          <Select value={facilityId} onValueChange={handleFacilityChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select Facility" />
            </SelectTrigger>
            <SelectContent>
              {facilities?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={unitId} onValueChange={setUnitId} disabled={!facilityId}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Select Unit" />
            </SelectTrigger>
            <SelectContent>
              {units?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[160px] justify-start text-sm">
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{format(date, 'PP')}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={handleCopyYesterday} disabled={isCopying || !facilityId || !unitId} className="w-full sm:w-auto">
            {isCopying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            <span className="sm:inline">Copy Yesterday</span>
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)} disabled={!facilityId || !unitId} className="w-full sm:w-auto">
            <Upload className="mr-2 h-4 w-4" />
            <span className="sm:inline">Import</span>
          </Button>
        </div>

        {/* Action Buttons - Full width on mobile */}
        <div className="flex gap-2 sm:gap-3">
          <Button variant="outline" onClick={() => handleSave('draft')} disabled={isSaving || isServiceDevSaving || !unitId} className="flex-1 sm:flex-none">
            {(isSaving || isServiceDevSaving) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            <span className="hidden xs:inline">Save </span>Draft
          </Button>
          <Button onClick={() => handleSave('submitted')} disabled={isSaving || isServiceDevSaving || !unitId} className="flex-1 sm:flex-none">
            {(isSaving || isServiceDevSaving) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit
          </Button>
        </div>
      </div>

      {/* Main Grid - Responsive columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {/* Service Development - Territory-based - Visible to Service Dev, Admin, Editor, Program Admin (not limited roles) */}
        {showServiceDevSection && !isLimitedViewRole && (
          <ServiceDevelopmentSection 
            data={serviceDevelopmentData} 
            updateField={updateServiceDevField}
            comments={data.commentsServiceDevelopment}
            onCommentsChange={(value) => updateField('commentsServiceDevelopment', value)}
          />
        )}

        {/* IOP Daily Entry - Only visible for IOP units (not limited roles) */}
        {isIOPUnit && showAllSections && !isLimitedViewRole && (
          <Card className="border-cyan-500/30 bg-cyan-500/5">
            <CardHeader className="py-3 bg-cyan-500/10">
              <CardTitle className="text-sm font-semibold">IOP Daily Entry</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-0.5">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Daily Total Groups to be Billed</span>
                <span className="font-mono text-sm w-28 text-right pr-2 font-medium">{data.iopDailyGroupsBilled}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">
                  Daily Enrolled Total
                  <span className="block text-xs text-muted-foreground">Calculated from IOP Patients list</span>
                </span>
                <span className="font-mono text-sm w-28 text-right pr-2 font-medium">{data.iopDailyEnrolledTotal}</span>
              </div>
              <NumberInput label="Daily Attendance Total" value={data.iopDailyAttendanceTotal} onChange={v => updateField('iopDailyAttendanceTotal', v)} />
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">Attendance Rate</span>
                <span className="text-sm font-medium">
                  {data.iopDailyEnrolledTotal > 0 
                    ? `${((data.iopDailyAttendanceTotal / data.iopDailyEnrolledTotal) * 100).toFixed(1)}%`
                    : '0.0%'}
                </span>
              </div>
              <NumberInput label="Daily Meals Total" value={data.iopDailyMealsTotal} onChange={v => updateField('iopDailyMealsTotal', v)} />
              <div className="mt-3">
                <Label className="text-sm">Comments</Label>
                <Textarea
                  className="mt-1 h-16 resize-none text-sm"
                  placeholder="IOP notes..."
                  value={data.commentsIop}
                  onChange={(e) => updateField('commentsIop', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* IOP Patients Card - Only visible for IOP units (not limited roles) */}
        {isIOPUnit && showAllSections && !isLimitedViewRole && (
          <IOPPatientCard 
            unitId={unitId || null} 
            facilityId={facilityId || null}
            entryDate={date}
            onTotalsChange={(totalGroups, patientCount) => {
              updateField('iopDailyGroupsBilled', totalGroups);
              updateField('iopDailyEnrolledTotal', patientCount);
            }}
          />
        )}

        {/* IOP Budget Rate - Admin only, only visible for IOP units */}
        {isIOPUnit && isAdmin && budgetConfig && (
          <Card className="border-violet-500/30 bg-violet-500/5">
            <CardHeader className="py-3 bg-violet-500/10">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>IOP Budget Rate</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={saveBudgetConfig}
                  disabled={isBudgetConfigSaving}
                  className="h-6 text-xs"
                >
                  {isBudgetConfigSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-0.5">
              <NumberInput label="$ per Group" value={budgetConfig.ratePerGroup} onChange={v => updateBudgetConfig({ ratePerGroup: v })} prefix="$" />
            </CardContent>
          </Card>
        )}

        {/* Census Breakdown - Visible to all except Nursing-only, hidden for IOP; Limited roles can view */}
        {(showAllSections || showLimitedSections) && !isIOPUnit && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader className="py-3 bg-blue-500/10">
              <CardTitle className="text-sm font-semibold">Census Breakdown (Pt Days)</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-0.5">
              <div className="text-xs font-medium text-muted-foreground mb-2">MCR</div>
              <NumberInput label="Full Days" value={data.mcrFullDays} onChange={v => updateField('mcrFullDays', v)} useDropdown />
              <NumberInput label="Co-Days" value={data.mcrCoDays} onChange={v => updateField('mcrCoDays', v)} useDropdown />
              <NumberInput label="Lifetime Days" value={data.mcrLifetimeDays} onChange={v => updateField('mcrLifetimeDays', v)} useDropdown />
              <div className="border-t border-border my-2" />
              <NumberInput label="HMO" value={data.hmoPtDays} onChange={v => updateField('hmoPtDays', v)} useDropdown />
              <NumberInput label="Medicaid" value={data.medicaidPtDays} onChange={v => updateField('medicaidPtDays', v)} useDropdown />
              <NumberInput label="Commercial" value={data.commercialPtDays} onChange={v => updateField('commercialPtDays', v)} useDropdown />
              <NumberInput label="Private Pay" value={data.privatePayPtDays} onChange={v => updateField('privatePayPtDays', v)} useDropdown />
              <NumberInput label="Charity/Indigent" value={data.charityIndigentPtDays} onChange={v => updateField('charityIndigentPtDays', v)} useDropdown />
              <NumberInput label="ELMHS" value={data.elmhsPtDays} onChange={v => updateField('elmhsPtDays', v)} useDropdown />
              <div className="border-t border-border my-2" />
              <div className="flex items-center justify-between py-1.5 font-semibold">
                <span className="text-sm">Total Census</span>
                <span className="font-mono text-sm w-28 text-right pr-2">{totalCensus}</span>
              </div>
              <div className="mt-3">
                <Label className="text-sm">Comments</Label>
                <Textarea
                  className="mt-1 h-16 resize-none text-sm"
                  placeholder="Census notes..."
                  value={data.commentsCensus}
                  onChange={(e) => updateField('commentsCensus', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clean Census - Visible alongside Census Breakdown (skipped on IOP) */}
        {(showAllSections || showLimitedSections) && !isIOPUnit && (() => {
          const variance = data.cleanCensus - totalCensus;
          const matches = variance === 0;
          const reasonMissing = !matches && !data.cleanCensusVarianceWhy.trim();
          return (
            <Card className="border-cyan-500/30 bg-cyan-500/5">
              <CardHeader className="py-3 bg-cyan-500/10">
                <CardTitle className="text-sm font-semibold">Clean Census</CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-0.5">
                <NumberInput
                  label="Clean Census"
                  value={data.cleanCensus}
                  onChange={v => updateField('cleanCensus', v)}
                  useDropdown
                />
                <div className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">Total Census (calculated)</span>
                  <span className="font-mono w-28 text-right pr-2">{totalCensus}</span>
                </div>
                <div className="border-t border-border my-2" />
                {matches ? (
                  <div className="flex items-center justify-between py-1.5 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Matches Total Census</span>
                    <span className="font-mono w-28 text-right pr-2">0</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between py-1.5 text-sm font-semibold">
                      <span>Variance</span>
                      <span className={`font-mono w-28 text-right pr-2 ${variance < 0 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
                        {variance > 0 ? `+${variance}` : variance}
                      </span>
                    </div>
                    <div className="mt-2">
                      <Label className="text-sm">
                        Reason for Variance <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        className={`mt-1 h-20 resize-none text-sm ${reasonMissing ? 'ring-1 ring-destructive border-destructive' : ''}`}
                        placeholder="Why does Clean Census differ from Total Census?"
                        value={data.cleanCensusVarianceWhy}
                        onChange={(e) => updateField('cleanCensusVarianceWhy', e.target.value)}
                      />
                      {reasonMissing && (
                        <p className="text-xs text-destructive mt-1">A reason is required when Clean Census differs from Total Census.</p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Budgeted Daily Cost - Admin only (not program_administrator, not limited roles) */}
        {isAdmin && role !== 'program_administrator' && !isLimitedViewRole && budgetConfig && (
          <Card className="border-indigo-500/30 bg-indigo-500/5">
            <CardHeader className="py-3 bg-indigo-500/10">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Budgeted Daily Cost</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={saveBudgetConfig}
                  disabled={isBudgetConfigSaving}
                  className="h-6 text-xs"
                >
                  {isBudgetConfigSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground mb-2 px-1">
                <span>Census</span>
                <span className="text-right">Projected Expense / Day</span>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1">
                {Array.from({ length: 36 }, (_, i) => (
                  <div 
                    key={i} 
                    className={`flex items-center justify-between py-1 px-1 rounded ${totalCensus === i ? 'bg-indigo-500/20 ring-1 ring-indigo-500/50' : ''}`}
                  >
                    <span className="text-sm font-mono w-8">{i}</span>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        className="h-7 text-right font-mono text-sm pl-5"
                        value={budgetConfig.budgetedDailyCosts[i.toString()] ?? 0}
                        onChange={(e) => updateBudgetedDailyCost(i, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Budget Revenue Rates - Admin only, hidden for Nursing, IOP, Program Admin, and limited roles */}
        {showAllSections && !isIOPUnit && role !== 'program_administrator' && !isLimitedViewRole && budgetConfig && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="py-3 bg-emerald-500/10">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Budget Revenue Rates {!isAdmin && <span className="text-xs font-normal text-muted-foreground">(Admin only)</span>}</span>
                {isAdmin && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={saveBudgetConfig}
                    disabled={isBudgetConfigSaving}
                    className="h-6 text-xs"
                  >
                    {isBudgetConfigSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-0.5">
              <div className="text-xs font-medium text-muted-foreground mb-2">MCR</div>
              {isAdmin ? (
                <>
                  <NumberInput label="Full Days" value={budgetConfig.rateMcrFullDays} onChange={v => updateBudgetConfig({ rateMcrFullDays: v })} prefix="$" />
                  <NumberInput label="Co-Days" value={budgetConfig.rateMcrCoDays} onChange={v => updateBudgetConfig({ rateMcrCoDays: v })} prefix="$" />
                  <NumberInput label="Lifetime Days" value={budgetConfig.rateMcrLifetimeDays} onChange={v => updateBudgetConfig({ rateMcrLifetimeDays: v })} prefix="$" />
                  <div className="border-t border-border my-2" />
                  <NumberInput label="HMO" value={budgetConfig.rateHmo} onChange={v => updateBudgetConfig({ rateHmo: v })} prefix="$" />
                  <NumberInput label="Medicaid" value={budgetConfig.rateMedicaid} onChange={v => updateBudgetConfig({ rateMedicaid: v })} prefix="$" />
                  <NumberInput label="Commercial" value={budgetConfig.rateCommercial} onChange={v => updateBudgetConfig({ rateCommercial: v })} prefix="$" />
                  <NumberInput label="Private Pay" value={budgetConfig.ratePrivatePay} onChange={v => updateBudgetConfig({ ratePrivatePay: v })} prefix="$" />
                  <NumberInput label="Charity/Indigent" value={budgetConfig.rateCharityIndigent} onChange={v => updateBudgetConfig({ rateCharityIndigent: v })} prefix="$" />
                  <NumberInput label="ELMHS" value={budgetConfig.rateElmhs} onChange={v => updateBudgetConfig({ rateElmhs: v })} prefix="$" />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Full Days</span><span className="font-mono text-sm w-28 text-right pr-2">${budgetConfig.rateMcrFullDays}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Co-Days</span><span className="font-mono text-sm w-28 text-right pr-2">${budgetConfig.rateMcrCoDays}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Lifetime Days</span><span className="font-mono text-sm w-28 text-right pr-2">${budgetConfig.rateMcrLifetimeDays}</span></div>
                  <div className="border-t border-border my-2" />
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">HMO</span><span className="font-mono text-sm w-28 text-right pr-2">${budgetConfig.rateHmo}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Medicaid</span><span className="font-mono text-sm w-28 text-right pr-2">${budgetConfig.rateMedicaid}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Commercial</span><span className="font-mono text-sm w-28 text-right pr-2">${budgetConfig.rateCommercial}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Private Pay</span><span className="font-mono text-sm w-28 text-right pr-2">${budgetConfig.ratePrivatePay}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Charity/Indigent</span><span className="font-mono text-sm w-28 text-right pr-2">${budgetConfig.rateCharityIndigent}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">ELMHS</span><span className="font-mono text-sm w-28 text-right pr-2">${budgetConfig.rateElmhs}</span></div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Utilization Breakdown (Potential Revenue) - Hidden for Nursing, IOP, and limited roles */}
        {showAllSections && !isIOPUnit && !isLimitedViewRole && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader className="py-3 bg-green-500/10">
              <CardTitle className="text-sm font-semibold">Utilization Breakdown (Potential Revenue)</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-0.5">
              <div className="text-xs font-medium text-muted-foreground mb-2">MCR (Census × Rate)</div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Full Days ({data.mcrFullDays} × ${rates.rateMcrFullDays})</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${calculatedRevenue.mcrFullDaysRev.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Co-Days ({data.mcrCoDays} × ${rates.rateMcrCoDays})</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${calculatedRevenue.mcrCoDaysRev.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Lifetime Days ({data.mcrLifetimeDays} × ${rates.rateMcrLifetimeDays})</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${calculatedRevenue.mcrLifetimeDaysRev.toLocaleString()}</span>
              </div>
              <div className="border-t border-border my-2" />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">HMO ({data.hmoPtDays} × ${rates.rateHmo})</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${calculatedRevenue.hmoRev.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Medicaid ({data.medicaidPtDays} × ${rates.rateMedicaid})</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${calculatedRevenue.medicaidRev.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Commercial ({data.commercialPtDays} × ${rates.rateCommercial})</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${calculatedRevenue.commercialRev.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Private Pay ({data.privatePayPtDays} × ${rates.ratePrivatePay})</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${calculatedRevenue.privatePayRev.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Charity/Indigent ({data.charityIndigentPtDays} × ${rates.rateCharityIndigent})</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${calculatedRevenue.charityIndigentRev.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">ELMHS ({data.elmhsPtDays} × ${rates.rateElmhs})</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${calculatedRevenue.elmhsRev.toLocaleString()}</span>
              </div>
              <div className="border-t border-border my-2" />
              <div className="flex items-center justify-between py-1.5 font-semibold">
                <span className="text-sm">Total Potential Revenue</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${totalRevenue.toLocaleString()}</span>
              </div>
              <NumberInput label="Total Deposits" value={data.totalDeposits} onChange={v => updateField('totalDeposits', v)} prefix="$" />
              <div className="flex items-center justify-between py-1.5 text-muted-foreground">
                <span className="text-sm">AVG PPD</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${avgPpd.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Staffing - Visible to Nursing, limited roles, and all other roles */}
        {(showNursingSections || showLimitedSections) && (
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardHeader className="py-3 bg-purple-500/10">
              <CardTitle className="text-sm font-semibold">Daily Staffing (Hours)</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-0.5">
              <NumberInput label="RN's" value={data.rnsHours} onChange={v => updateField('rnsHours', v)} />
              <NumberInput label="LPN's" value={data.lpnsHours} onChange={v => updateField('lpnsHours', v)} />
              <NumberInput label="MHT's" value={data.mhtsHours} onChange={v => updateField('mhtsHours', v)} />
              <NumberInput label="Case Manager" value={data.caseManagerHours} onChange={v => updateField('caseManagerHours', v)} />
              <NumberInput label="Housekeepers" value={data.housekeepersHours} onChange={v => updateField('housekeepersHours', v)} />
              <div className="border-t border-border my-2" />
              <NumberInput label="One-to-One's" value={data.oneToOnesHours} onChange={v => updateField('oneToOnesHours', v)} />
              <NumberInput label="Agency RN's" value={data.agencyRnsHours} onChange={v => updateField('agencyRnsHours', v)} />
              <NumberInput label="Agency LPN's" value={data.agencyLpnsHours} onChange={v => updateField('agencyLpnsHours', v)} />
              <NumberInput label="Agency MHT's" value={data.agencyMhtsHours} onChange={v => updateField('agencyMhtsHours', v)} />
              <NumberInput label="Training/Non-Pro" value={data.trainingNonProHours} onChange={v => updateField('trainingNonProHours', v)} />
              <NumberInput label="PTO" value={data.ptoHours} onChange={v => updateField('ptoHours', v)} />
              <div className="mt-3">
                <Label className="text-sm">Comments</Label>
                <Textarea
                  className="mt-1 h-16 resize-none text-sm"
                  placeholder="Staffing notes..."
                  value={data.commentsStaffing}
                  onChange={(e) => updateField('commentsStaffing', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Position Per Day Cost - Hidden for Nursing and limited roles */}
        {showAllSections && !isLimitedViewRole && (
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader className="py-3 bg-orange-500/10">
              <CardTitle className="text-sm font-semibold">Position Per Day Cost {!isAdmin && <span className="text-xs font-normal text-muted-foreground">(Admin only)</span>}</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-0.5">
              {isAdmin ? (
                <>
                  <NumberInput label="RN's" value={data.rnsCost} onChange={v => updateField('rnsCost', v)} prefix="$" />
                  <NumberInput label="LPN's" value={data.lpnsCost} onChange={v => updateField('lpnsCost', v)} prefix="$" />
                  <NumberInput label="MHT's" value={data.mhtsCost} onChange={v => updateField('mhtsCost', v)} prefix="$" />
                  <NumberInput label="Case Manager" value={data.caseManagerCost} onChange={v => updateField('caseManagerCost', v)} prefix="$" />
                  <NumberInput label="Housekeepers" value={data.housekeepersCost} onChange={v => updateField('housekeepersCost', v)} prefix="$" />
                  <div className="border-t border-border my-2" />
                  <NumberInput label="One-to-One's" value={data.oneToOnesCost} onChange={v => updateField('oneToOnesCost', v)} prefix="$" />
                  <NumberInput label="Agency RN's" value={data.agencyRnsCost} onChange={v => updateField('agencyRnsCost', v)} prefix="$" />
                  <NumberInput label="Agency LPN's" value={data.agencyLpnsCost} onChange={v => updateField('agencyLpnsCost', v)} prefix="$" />
                  <NumberInput label="Agency MHT's" value={data.agencyMhtsCost} onChange={v => updateField('agencyMhtsCost', v)} prefix="$" />
                  <NumberInput label="Training/Non-Pro" value={data.trainingNonProCost} onChange={v => updateField('trainingNonProCost', v)} prefix="$" />
                  <NumberInput label="PTO" value={data.ptoCost} onChange={v => updateField('ptoCost', v)} prefix="$" />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">RN's</span><span className="font-mono text-sm w-28 text-right pr-2">${data.rnsCost}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">LPN's</span><span className="font-mono text-sm w-28 text-right pr-2">${data.lpnsCost}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">MHT's</span><span className="font-mono text-sm w-28 text-right pr-2">${data.mhtsCost}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Case Manager</span><span className="font-mono text-sm w-28 text-right pr-2">${data.caseManagerCost}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Housekeepers</span><span className="font-mono text-sm w-28 text-right pr-2">${data.housekeepersCost}</span></div>
                  <div className="border-t border-border my-2" />
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">One-to-One's</span><span className="font-mono text-sm w-28 text-right pr-2">${data.oneToOnesCost}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Agency RN's</span><span className="font-mono text-sm w-28 text-right pr-2">${data.agencyRnsCost}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Agency LPN's</span><span className="font-mono text-sm w-28 text-right pr-2">${data.agencyLpnsCost}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Agency MHT's</span><span className="font-mono text-sm w-28 text-right pr-2">${data.agencyMhtsCost}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">Training/Non-Pro</span><span className="font-mono text-sm w-28 text-right pr-2">${data.trainingNonProCost}</span></div>
                  <div className="flex items-center justify-between py-1.5"><span className="text-sm">PTO</span><span className="font-mono text-sm w-28 text-right pr-2">${data.ptoCost}</span></div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Employee Risk - Hidden for Nursing, IOP, and limited roles */}
        {showAllSections && !isIOPUnit && !isLimitedViewRole && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardHeader className="py-3 bg-red-500/10">
              <CardTitle className="text-sm font-semibold">Employee Risk</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-0.5">
              <NumberInput label="# Employees Hired" value={data.employeesHired} onChange={v => updateField('employeesHired', v)} useDropdown />
              <NumberInput label="# Employees Termed" value={data.employeesTermed} onChange={v => updateField('employeesTermed', v)} useDropdown />
              <NumberInput label="# on Performance Plans" value={data.employeesOnPip} onChange={v => updateField('employeesOnPip', v)} useDropdown />
              <NumberInput label="Employment Claims" value={data.employmentClaims} onChange={v => updateField('employmentClaims', v)} useDropdown />
              <div className="border-t border-border my-2" />
              <NumberInput label="TOTAL PAYROLL" value={data.totalPayroll} onChange={v => updateField('totalPayroll', v)} prefix="$" />
              <div className="mt-3">
                <Label className="text-sm">Comments</Label>
                <Textarea
                  className="mt-1 h-16 resize-none text-sm"
                  placeholder="Employee risk notes..."
                  value={data.commentsEmployeeRisk}
                  onChange={(e) => updateField('commentsEmployeeRisk', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Expenses - Hidden for Nursing, IOP, and limited roles */}
        {showAllSections && !isIOPUnit && !isLimitedViewRole && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="py-3 bg-amber-500/10">
              <CardTitle className="text-sm font-semibold">Abnormal Expenses</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-0.5">
              <YesNoToggle label="Off-Formulary Pharmacy PPD" value={data.offFormularyPharmacyPpd > 0} onChange={v => updateField('offFormularyPharmacyPpd', v ? 1 : 0)} />
              <YesNoToggle label="LAB PPD Overage" value={data.labPpdOverage > 0} onChange={v => updateField('labPpdOverage', v ? 1 : 0)} />
              <YesNoToggle label="DIETARY Over Budget" value={data.dietaryOverBudget > 0} onChange={v => updateField('dietaryOverBudget', v ? 1 : 0)} />
              <YesNoToggle label="SUPPLIES Orders Placed" value={data.suppliesOrdersPlaced > 0} onChange={v => updateField('suppliesOrdersPlaced', v ? 1 : 0)} />
              <YesNoToggle label="RTBH Outside Budget" value={data.rtbhOutsideBudgetSubmitted > 0} onChange={v => updateField('rtbhOutsideBudgetSubmitted', v ? 1 : 0)} />
              <div className="mt-3">
                <Label className="text-sm">Notes</Label>
                <Textarea
                  className="mt-1 h-16 resize-none text-sm"
                  placeholder="Any abnormal expenses outside budget?"
                  value={data.abnormalExpensesNotes}
                  onChange={(e) => updateField('abnormalExpensesNotes', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Projected Daily - Hidden for Nursing and limited roles */}
        {showAllSections && !isLimitedViewRole && (
          <Card className="border-teal-500/30 bg-teal-500/5">
            <CardHeader className="py-3 bg-teal-500/10">
              <CardTitle className="text-sm font-semibold">Projected Daily</CardTitle>
            </CardHeader>
            <CardContent className="py-3 space-y-0.5">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Projected Daily Revenue</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm">Projected Daily Expense</span>
                <span className="font-mono text-sm w-28 text-right pr-2">${budgetedDailyCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="border-t border-border my-2" />
              <div className="flex items-center justify-between py-1.5 font-semibold">
                <span className="text-sm">Daily "POP"</span>
                <span className={`font-mono text-sm w-28 text-right pr-2 ${totalRevenue - budgetedDailyCost >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${(totalRevenue - budgetedDailyCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quality Risk Events - Visible to Nursing, limited roles, and all other roles, including IOP */}
        {(showNursingSections || showLimitedSections) && (
          <Card className="border-pink-500/30 bg-pink-500/5 lg:col-span-2 xl:col-span-1">
            <CardHeader className="py-3 bg-pink-500/10">
              <CardTitle className="text-sm font-semibold">Quality Risk Events (Patient Safety)</CardTitle>
            </CardHeader>
            <CardContent className="py-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <NumberInput label="Late H&P" value={data.lateHp} onChange={v => updateField('lateHp', v)} useDropdown />
                <NumberInput label="Late Initial Tx Plans" value={data.lateInitialTreatmentPlans} onChange={v => updateField('lateInitialTreatmentPlans', v)} useDropdown />
                <NumberInput label="Late Psych Evals" value={data.latePsychEvals} onChange={v => updateField('latePsychEvals', v)} useDropdown />
              </div>
              {/* Conditional "Why?" comment box for late entries - positioned right after the late fields */}
              {(data.lateHp > 0 || data.lateInitialTreatmentPlans > 0 || data.latePsychEvals > 0) && (
                <div className="mt-2 mb-3 p-3 bg-pink-500/10 rounded-md border border-pink-500/30">
                  <Label className="text-sm font-semibold text-pink-700 dark:text-pink-300">Why?</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Please explain why there are late entries for H&amp;P, Initial Tx Plans, or Psych Evals.
                  </p>
                  <Textarea
                    className="mt-1 h-20 resize-none text-sm"
                    placeholder="Explain why these entries are late..."
                    value={data.lateQualityWhy}
                    onChange={(e) => updateField('lateQualityWhy', e.target.value)}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <NumberInput label="Late DC Summaries" value={data.lateDcSummaries} onChange={v => updateField('lateDcSummaries', v)} useDropdown />
                <NumberInput label="Falls w/ Injury" value={data.fallsWithInjury} onChange={v => updateField('fallsWithInjury', v)} useDropdown />
                <NumberInput label="Falls w/o Injury" value={data.fallsWithoutInjury} onChange={v => updateField('fallsWithoutInjury', v)} useDropdown />
                <NumberInput label="Incident w/ Injury" value={data.incidentReportWithInjury} onChange={v => updateField('incidentReportWithInjury', v)} useDropdown />
                <NumberInput label="Incident w/o Injury" value={data.incidentReportWithoutInjury} onChange={v => updateField('incidentReportWithoutInjury', v)} useDropdown />
                <NumberInput label="Medication Variance" value={data.medicationVariance} onChange={v => updateField('medicationVariance', v)} useDropdown />
                <NumberInput label="Hospital Transfers (ret)" value={data.hospitalTransfersReturned} onChange={v => updateField('hospitalTransfersReturned', v)} useDropdown />
                <NumberInput label="Hospital Transfers (no ret)" value={data.hospitalTransfersNotReturned} onChange={v => updateField('hospitalTransfersNotReturned', v)} useDropdown />
                <NumberInput label="Restraints" value={data.restraints} onChange={v => updateField('restraints', v)} useDropdown />
                <NumberInput label="Seclusions" value={data.seclusions} onChange={v => updateField('seclusions', v)} useDropdown />
                <NumberInput label="Complaints" value={data.complaints} onChange={v => updateField('complaints', v)} useDropdown />
                <NumberInput label="Grievances" value={data.grievances} onChange={v => updateField('grievances', v)} useDropdown />
                <NumberInput label="D/C Against Medical Advice" value={data.dcAgainstMedicalAdvice} onChange={v => updateField('dcAgainstMedicalAdvice', v)} useDropdown />
                <NumberInput label="Safety Rounds" value={data.safetyRounds} onChange={v => updateField('safetyRounds', v)} useDropdown />
                <NumberInput label="Admin Chart Audits" value={data.adminChartAudits} onChange={v => updateField('adminChartAudits', v)} useDropdown />
                <NumberInput label="Nursing Chart Audits" value={data.nursingChartAudits} onChange={v => updateField('nursingChartAudits', v)} useDropdown />
                <NumberInput label="Clinical Chart Audits" value={data.clinicalChartAudits} onChange={v => updateField('clinicalChartAudits', v)} useDropdown />
                <NumberInput label="Quality Chart Audits" value={data.qualityChartAudits} onChange={v => updateField('qualityChartAudits', v)} useDropdown />
                <NumberInput label="# Charts Requested" value={data.chartsRequested} onChange={v => updateField('chartsRequested', v)} useDropdown />
                <NumberInput label="# Appeals Sent" value={data.appealsSent} onChange={v => updateField('appealsSent', v)} useDropdown />
                <NumberInput label="RAC/ZPIC Audits Open" value={data.racZpicAuditsOpen} onChange={v => updateField('racZpicAuditsOpen', v)} useDropdown />
                <NumberInput label="MTP Signed by MD" value={data.mtpSignedByMd} onChange={v => updateField('mtpSignedByMd', v)} useDropdown max={20} />
                <NumberInput label="Initial Cert" value={data.initialCert} onChange={v => updateField('initialCert', v)} useDropdown max={20} />
              </div>
              {/* Conditional "Why?" comment box for Initial Cert less than Admits - positioned right after the field */}
              {data.initialCert < totalAdmits && (
                <div className="mt-2 mb-3 p-3 bg-orange-500/10 rounded-md border border-orange-500/30">
                  <Label className="text-sm font-semibold text-orange-700 dark:text-orange-300">Why?</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Initial Cert ({data.initialCert}) is less than Admits ({totalAdmits}). Please explain.
                  </p>
                  <Textarea
                    className="mt-1 h-20 resize-none text-sm"
                    placeholder="Explain why Initial Certs are less than Admits..."
                    value={data.initialCertWhy}
                    onChange={(e) => updateField('initialCertWhy', e.target.value)}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <NumberInput label="Recert" value={data.recert} onChange={v => updateField('recert', v)} useDropdown max={20} />
                <NumberInput label="# of Internal D/C Surveys Executed" value={data.internalDcSurveysExecuted} onChange={v => updateField('internalDcSurveysExecuted', v)} useDropdown max={20} />
              </div>
              {/* Conditional "Why?" comment box for D/C surveys less than discharges - positioned right after the field */}
              {data.internalDcSurveysExecuted < totalDischarges && (
                <div className="mt-2 mb-3 p-3 bg-amber-500/10 rounded-md border border-amber-500/30">
                  <Label className="text-sm font-semibold text-amber-700 dark:text-amber-300">Why?</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    # of Internal D/C Surveys Executed ({data.internalDcSurveysExecuted}) is less than Discharges ({totalDischarges}). Please explain.
                  </p>
                  <Textarea
                    className="mt-1 h-20 resize-none text-sm"
                    placeholder="Explain why fewer surveys were executed than discharges..."
                    value={data.internalDcSurveysWhy}
                    onChange={(e) => updateField('internalDcSurveysWhy', e.target.value)}
                  />
                </div>
              )}
              {/* Deficiency Reports to Dept Head */}
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between gap-2 py-1.5">
                  <Label className="text-sm flex-1">Deficiency Reports to Dept Head</Label>
                  <div className="w-28">
                    <Select 
                      value={data.deficiencyReportsToDeptHead ? 'yes' : 'no'} 
                      onValueChange={(v) => updateField('deficiencyReportsToDeptHead', v === 'yes')}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              {/* Conditional "Why?" comment box for Deficiency Reports No - positioned right after the field */}
              {!data.deficiencyReportsToDeptHead && (
                <div className="mt-2 mb-3 p-3 bg-red-500/10 rounded-md border border-red-500/30">
                  <Label className="text-sm font-semibold text-red-700 dark:text-red-300">Why?</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Please explain why Deficiency Reports were not sent to Dept Head.
                  </p>
                  <Textarea
                    className="mt-1 h-20 resize-none text-sm"
                    placeholder="Explain why deficiency reports were not sent..."
                    value={data.deficiencyReportsWhy}
                    onChange={(e) => updateField('deficiencyReportsWhy', e.target.value)}
                  />
                </div>
              )}
              <div className="mt-3">
                <Label className="text-sm">Comments</Label>
                <Textarea
                  className="mt-1 h-16 resize-none text-sm"
                  placeholder="Quality risk notes..."
                  value={data.commentsQualityRisk}
                  onChange={(e) => updateField('commentsQualityRisk', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={showCopyConfirm} onOpenChange={setShowCopyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will copy yesterday's data into today's form. Any unsaved changes will be overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCopyYesterday}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DailyOpsImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        facilityId={facilityId}
        unitId={unitId}
        onImportComplete={() => {
          // Trigger refetch by changing date back and forth (or use queryClient)
          const currentDate = new Date(date);
          setDate(new Date(currentDate.getTime() + 1));
          setTimeout(() => setDate(currentDate), 100);
        }}
      />
    </div>
  );
}