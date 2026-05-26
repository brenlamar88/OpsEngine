import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface DailyOpsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilityId: string;
  unitId: string;
  onImportComplete: () => void;
}

// Known daily_operations columns (snake_case keys from the DB)
const DAILY_OPS_COLUMNS = new Set([
  'date', 'daily_pop', 'discharges', 'mcr_full_days', 'mcr_co_days', 'mcr_lifetime_days',
  'hmo_pt_days', 'medicaid_pt_days', 'commercial_pt_days', 'private_pay_pt_days',
  'charity_indigent_pt_days', 'elmhs_pt_days',
  'mcr_full_days_rev', 'mcr_co_days_rev', 'mcr_lifetime_days_rev', 'hmo_rev', 'medicaid_rev',
  'commercial_rev', 'private_pay_rev', 'charity_indigent_rev', 'elmhs_rev',
  'rate_mcr_full_days', 'rate_mcr_co_days', 'rate_mcr_lifetime_days', 'rate_hmo',
  'rate_medicaid', 'rate_commercial', 'rate_private_pay', 'rate_charity_indigent', 'rate_elmhs',
  'total_deposits', 'rns_hours', 'lpns_hours', 'mhts_hours', 'case_manager_hours',
  'housekeepers_hours', 'one_to_ones_hours', 'agency_rns_hours', 'agency_lpns_hours',
  'agency_mhts_hours', 'training_non_pro_hours', 'pto_hours',
  'rns_cost', 'lpns_cost', 'mhts_cost', 'case_manager_cost', 'housekeepers_cost',
  'one_to_ones_cost', 'agency_rns_cost', 'agency_lpns_cost', 'agency_mhts_cost',
  'training_non_pro_cost', 'pto_cost',
  'employees_hired', 'employees_termed', 'employees_on_pip', 'employment_claims',
  'total_payroll', 'off_formulary_pharmacy_ppd', 'lab_ppd_overage', 'dietary_over_budget',
  'supplies_orders_placed', 'rtbh_outside_budget_submitted',
  'has_abnormal_expenses', 'abnormal_expenses_notes',
  'late_hp', 'late_initial_treatment_plans', 'late_psych_evals', 'late_dc_summaries',
  'falls_with_injury', 'falls_without_injury', 'incident_report_with_injury',
  'incident_report_without_injury', 'medication_variance', 'hospital_transfers_returned',
  'hospital_transfers_not_returned', 'restraints', 'seclusions', 'complaints', 'grievances',
  'dc_against_medical_advice', 'safety_rounds', 'admin_chart_audits', 'nursing_chart_audits',
  'clinical_chart_audits', 'quality_chart_audits', 'charts_requested', 'appeals_sent',
  'rac_zpic_audits_open', 'mtp_signed_by_md', 'internal_dc_surveys_executed',
  'initial_cert', 'recert', 'deficiency_reports_to_dept_head',
  'five_star_surveys', 'projected_daily_revenue', 'projected_daily_expense',
  'projected_profit_loss', 'mtd_trailing_profit_loss',
  'iop_daily_groups_billed', 'iop_daily_attendance_total', 'iop_daily_meals_total', 'iop_daily_enrolled_total',
  'comments_census', 'comments_staffing', 'comments_quality_risk', 'comments_iop',
  'comments_employee_risk', 'comments_service_development',
  'late_quality_why', 'internal_dc_surveys_why', 'initial_cert_why',
  'deficiency_reports_why', 'top_3_categories',
  'inquiries', 'referrals', 'red_territory_admits', 'blue_territory_admits', 'white_territory_admits',
  'face_to_face_touches', 'quality_touches', 'inservices', 'pre_screened_by_sdrs', 'needs_analysis',
]);

// Service development metric columns (mapped from spreadsheet keys)
const SERVICE_DEV_METRICS = new Set([
  'inquiries', 'referrals', 'admits', 'discharges', 'face_to_face_touches',
  'quality_touches', 'inservices', 'pre_screened_by_sdrs', 'needs_analysis', 'five_star_surveys',
]);

function isNonEmptyNonZero(val: unknown): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number' && val === 0) return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  if (typeof val === 'string' && !isNaN(Number(val)) && Number(val) === 0) return false;
  return true;
}

function parseExcelDate(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0];
    // Try MM/DD/YYYY
    const m2 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m2) return `${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`;
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return null;
}

export function DailyOpsImportDialog({ open, onOpenChange, facilityId, unitId, onImportComplete }: DailyOpsImportDialogProps) {
  const { user } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileName(file?.name || null);
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      
      // Read all rows as array of arrays
      const rawData: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      
      if (rawData.length < 3) {
        toast.error('File must have at least 3 rows (header, keys, data)');
        setIsImporting(false);
        return;
      }

      // Row 2 (index 1) = database column keys
      const keys = (rawData[1] as string[]).map(k => String(k).trim().toLowerCase());
      const dateColIdx = keys.indexOf('date');
      
      if (dateColIdx === -1) {
        toast.error('No "date" column found in Row 2 key mapping');
        setIsImporting(false);
        return;
      }

      let imported = 0;
      let skipped = 0;

      // Process data rows (index 2+)
      for (let r = 2; r < rawData.length; r++) {
        const row = rawData[r] as unknown[];
        if (!row || row.length === 0) { skipped++; continue; }

        const dateStr = parseExcelDate(row[dateColIdx]);
        if (!dateStr) { skipped++; continue; }

        // Build partial record from non-blank/non-zero values
        const dailyOpsPartial: Record<string, unknown> = {};
        
        for (let c = 0; c < keys.length; c++) {
          const key = keys[c];
          if (!key || key === 'date') continue;
          const val = row[c];
          
          if (DAILY_OPS_COLUMNS.has(key) && isNonEmptyNonZero(val)) {
            // Convert to appropriate type
            if (typeof val === 'string' && !isNaN(Number(val))) {
              dailyOpsPartial[key] = Number(val);
            } else {
              dailyOpsPartial[key] = val;
            }
          }
        }

        // Fetch existing record
        const { data: existing } = await supabase
          .from('daily_operations')
          .select('*')
          .eq('unit_id', unitId)
          .eq('date', dateStr)
          .maybeSingle();

        // Merge: imported values win only when non-blank/non-zero
        const merged = { ...(existing || {}), ...dailyOpsPartial };
        
        // Always set these fields
        merged.unit_id = unitId;
        merged.facility_id = facilityId;
        merged.date = dateStr;
        merged.submitted_by = user.id;
        merged.status = merged.status || 'draft';

        // Remove id if creating new
        if (!existing) delete merged.id;
        // Remove metadata fields that shouldn't be set manually
        delete merged.created_at;
        delete merged.updated_at;

        if (existing) {
          const { error } = await supabase
            .from('daily_operations')
            .update(dailyOpsPartial as any)
            .eq('id', existing.id);
          if (error) { console.error('Update error:', error); skipped++; continue; }
        } else {
          const { error } = await supabase
            .from('daily_operations')
            .insert(merged as any);
          if (error) { console.error('Insert error:', error); skipped++; continue; }
        }

        imported++;
      }

      toast.success(`Import complete: ${imported} rows imported, ${skipped} skipped`);
      onImportComplete();
      onOpenChange(false);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to import file. Please check the format.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Daily Operations
          </DialogTitle>
          <DialogDescription>
            Upload an XLSX file matching the template format. Blank or zero values will not overwrite existing data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Expected format:</strong></p>
            <p>• Row 1: Human-readable headers</p>
            <p>• Row 2: Database column keys (snake_case)</p>
            <p>• Row 3+: Data (one row per day)</p>
            <p>• Must include a "date" column</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-file">Select XLSX File</Label>
            <Input
              id="import-file"
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              disabled={isImporting}
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">Selected: {fileName}</p>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={!fileName || isImporting || !facilityId || !unitId}
            className="w-full"
          >
            {isImporting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" /> Import</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
