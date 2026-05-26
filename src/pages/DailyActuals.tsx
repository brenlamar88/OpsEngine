import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Save, Send, Copy, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useDailyActuals } from '@/hooks/useDailyActuals';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function DailyActuals() {
  const [date, setDate] = useState<Date>(new Date());
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);

  const { data: facilities } = useQuery({
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

  const { data: units } = useQuery({
    queryKey: ['units', facilityId],
    queryFn: async () => {
      if (!facilityId) return [];
      const { data } = await supabase
        .from('units')
        .select('id, name')
        .eq('facility_id', facilityId)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: !!facilityId,
  });

  // Reset unit when facility changes
  const handleFacilityChange = (value: string) => {
    setFacilityId(value === 'all' ? null : value);
    setUnitId(null);
  };

  const {
    rows,
    entries,
    loading,
    saving,
    budgetYearId,
    updateEntry,
    saveEntries,
    copyYesterday,
  } = useDailyActuals(date, facilityId, unitId);

  // Group rows by section
  const groupedRows = rows.reduce((acc, row) => {
    if (!acc[row.section_name]) acc[row.section_name] = [];
    acc[row.section_name].push(row);
    return acc;
  }, {} as Record<string, typeof rows>);

  return (
    <>
    <div className="min-h-screen p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Daily Actuals Entry</h1>
          <p className="text-sm text-muted-foreground">
            Enter daily actual values for {format(date, 'MMMM d, yyyy')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={facilityId || ''} onValueChange={handleFacilityChange}>
            <SelectTrigger className="w-[180px]">
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
          <Select value={unitId || ''} onValueChange={(v) => setUnitId(v || null)} disabled={!facilityId}>
            <SelectTrigger className="w-[180px]">
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
              <Button variant="outline" className="w-[200px] justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={() => setShowCopyConfirm(true)} disabled={saving || !budgetYearId || !unitId}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Yesterday
          </Button>
          <Button variant="outline" onClick={() => saveEntries('draft')} disabled={saving || !budgetYearId || !unitId}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Draft
          </Button>
          <Button onClick={() => saveEntries('submitted')} disabled={saving || !budgetYearId || !unitId}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit
          </Button>
        </div>
      </div>

      {!unitId && (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          Please select a facility and unit to enter daily actuals.
        </div>
      )}

      {unitId && !budgetYearId && (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No budget year found for {date.getFullYear()}. Please create one in the Admin page.
        </div>
      )}

      {loading && unitId && budgetYearId && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && unitId && budgetYearId && rows.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No actual-enabled rows found. Seed the budget structure from the Admin page.
        </div>
      )}

      {!loading && unitId && budgetYearId && rows.length > 0 && (
        <div className="space-y-6 max-w-4xl">
          {Object.entries(groupedRows).map(([sectionName, sectionRows]) => (
            <div key={sectionName} className="rounded-lg border border-border bg-card">
              <div className="border-b border-border bg-muted/50 px-4 py-3">
                <h2 className="font-semibold">{sectionName}</h2>
              </div>
              <div className="divide-y divide-border">
                {sectionRows.map((row) => (
                  <div key={row.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <Label className="text-sm font-medium">{row.name}</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          className="mt-2 font-mono"
                          value={entries[row.id]?.value || ''}
                          onChange={(e) => updateEntry(row.id, 'value', e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-muted-foreground">Notes (optional)</Label>
                        <Textarea
                          placeholder="Add notes..."
                          className="mt-2 h-10 resize-none"
                          value={entries[row.id]?.notes || ''}
                          onChange={(e) => updateEntry(row.id, 'notes', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    <AlertDialog open={showCopyConfirm} onOpenChange={setShowCopyConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will copy yesterday's entries into today's form.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction onClick={() => { copyYesterday(); setShowCopyConfirm(false); }}>Yes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}