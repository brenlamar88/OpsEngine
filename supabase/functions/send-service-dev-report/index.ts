import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TerritoryMetrics {
  inquiries: number;
  referrals: number;
  admits: number;
  discharges: number;
}

interface UnitData {
  unit_name: string;
  territories: Record<string, TerritoryMetrics>;
  totals: TerritoryMetrics & { ref_admit_ratio: string };
  census: number;
}

interface FacilityData {
  facility_name: string;
  facility_code: string;
  units: UnitData[];
  totals: TerritoryMetrics & { ref_admit_ratio: string };
  census: number;
}

function ratio(refs: number, admits: number): string {
  return admits > 0 ? (refs / admits).toFixed(2) : "N/A";
}

function generateHtml(data: FacilityData[], reportDate: string): string {
  let html = `<!DOCTYPE html><html><head><style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #333; margin: 20px; }
    h1 { color: #1a365d; }
    h2 { color: #2c5282; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; }
    h3 { color: #4a5568; margin-top: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: center; }
    th { background-color: #f7fafc; font-weight: 600; }
    tr:nth-child(even) { background-color: #f9fafb; }
    .metric-label { text-align: left; font-weight: 500; }
    .total-row { background-color: #edf2f7 !important; font-weight: 600; }
    .no-data { color: #718096; font-style: italic; }
    .grand-total { background-color: #e2e8f0 !important; font-weight: 700; }
  </style></head><body>
    <h1>Daily Service Development Report</h1>
    <p><strong>Report Date:</strong> ${reportDate}</p>
    <p><strong>Generated:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}</p>`;

  if (data.length === 0) {
    html += `<p class="no-data">No service development data found for this date.</p>`;
  } else {
    // Grand totals
    const grandTotals: TerritoryMetrics = { inquiries: 0, referrals: 0, admits: 0, discharges: 0 };
    let grandCensus = 0;

    for (const facility of data) {
      html += `<div><h2>${facility.facility_name} (${facility.facility_code})</h2>`;

      if (facility.units.length === 0) {
        html += `<p class="no-data">No entries submitted for this facility.</p>`;
      } else {
        for (const unit of facility.units) {
          html += `<h3>${unit.unit_name} — Census: ${unit.census}</h3>
            <table>
              <tr><th class="metric-label">Metric</th><th>Red</th><th>White</th><th>Blue</th><th>Total</th></tr>`;

          const metrics: (keyof TerritoryMetrics)[] = ['inquiries', 'referrals', 'admits', 'discharges'];
          const labels: Record<string, string> = {
            inquiries: 'Inquiries',
            referrals: 'Referrals',
            admits: 'Admits',
            discharges: 'Discharges',
          };

          for (const m of metrics) {
            const red = unit.territories['Red']?.[m] || 0;
            const white = unit.territories['White']?.[m] || 0;
            const blue = unit.territories['Blue']?.[m] || 0;
            const total = red + white + blue;
            html += `<tr><td class="metric-label">${labels[m]}</td><td>${red}</td><td>${white}</td><td>${blue}</td><td><strong>${total}</strong></td></tr>`;
          }

          // Ref-Admit Ratio row
          const redRatio = ratio(unit.territories['Red']?.referrals || 0, unit.territories['Red']?.admits || 0);
          const whiteRatio = ratio(unit.territories['White']?.referrals || 0, unit.territories['White']?.admits || 0);
          const blueRatio = ratio(unit.territories['Blue']?.referrals || 0, unit.territories['Blue']?.admits || 0);
          html += `<tr class="total-row"><td class="metric-label">Ref-Admit Ratio</td><td>${redRatio}</td><td>${whiteRatio}</td><td>${blueRatio}</td><td><strong>${unit.totals.ref_admit_ratio}</strong></td></tr>`;
          html += `</table>`;
        }

        // Facility totals
        html += `<table>
          <tr class="total-row"><td class="metric-label" colspan="5"><strong>${facility.facility_name} Totals</strong></td></tr>
          <tr><th class="metric-label">Metric</th><th colspan="3"></th><th>Total</th></tr>
          <tr><td class="metric-label">Census</td><td colspan="3"></td><td><strong>${facility.census}</strong></td></tr>
          <tr><td class="metric-label">Inquiries</td><td colspan="3"></td><td><strong>${facility.totals.inquiries}</strong></td></tr>
          <tr><td class="metric-label">Referrals</td><td colspan="3"></td><td><strong>${facility.totals.referrals}</strong></td></tr>
          <tr><td class="metric-label">Admits</td><td colspan="3"></td><td><strong>${facility.totals.admits}</strong></td></tr>
          <tr><td class="metric-label">Discharges</td><td colspan="3"></td><td><strong>${facility.totals.discharges}</strong></td></tr>
          <tr class="total-row"><td class="metric-label">Ref-Admit Ratio</td><td colspan="3"></td><td><strong>${facility.totals.ref_admit_ratio}</strong></td></tr>
        </table>`;

        grandTotals.inquiries += facility.totals.inquiries;
        grandTotals.referrals += facility.totals.referrals;
        grandTotals.admits += facility.totals.admits;
        grandTotals.discharges += facility.totals.discharges;
        grandCensus += facility.census;
      }

      html += `</div>`;
    }

    // Grand total section
    html += `<h2>Grand Totals — All Facilities</h2>
      <table>
        <tr><th class="metric-label">Metric</th><th>Total</th></tr>
        <tr><td class="metric-label">Census</td><td><strong>${grandCensus}</strong></td></tr>
        <tr><td class="metric-label">Inquiries</td><td><strong>${grandTotals.inquiries}</strong></td></tr>
        <tr><td class="metric-label">Referrals</td><td><strong>${grandTotals.referrals}</strong></td></tr>
        <tr><td class="metric-label">Admits</td><td><strong>${grandTotals.admits}</strong></td></tr>
        <tr><td class="metric-label">Discharges</td><td><strong>${grandTotals.discharges}</strong></td></tr>
        <tr class="grand-total"><td class="metric-label">Ref-Admit Ratio</td><td><strong>${ratio(grandTotals.referrals, grandTotals.admits)}</strong></td></tr>
      </table>`;
  }

  html += `<hr style="margin-top: 40px; border: none; border-top: 1px solid #e2e8f0;">
    <p style="color: #718096; font-size: 12px;">This is an automated report from Freedom Healthcare Operations System.</p>
    </body></html>`;

  return html;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting Service Development report generation...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine report date
    let reportDate: string;
    try {
      const body = await req.json();
      if (body?.date) {
        reportDate = body.date;
      } else {
        const now = new Date();
        const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
        ct.setDate(ct.getDate() - 1);
        reportDate = ct.toISOString().split('T')[0];
      }
    } catch {
      const now = new Date();
      const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      ct.setDate(ct.getDate() - 1);
      reportDate = ct.toISOString().split('T')[0];
    }

    console.log(`Report date: ${reportDate}`);

    // Fetch facilities, units, service dev entries, and daily operations in parallel
    const [facilitiesRes, unitsRes, entriesRes, opsRes] = await Promise.all([
      supabase.from('facilities').select('id, name, code').eq('is_active', true).order('name'),
      supabase.from('units').select('id, name, facility_id').eq('is_active', true),
      supabase.from('service_development_entries')
        .select('unit_id, territory, metric_name, numeric_value')
        .eq('date', reportDate)
        .in('metric_name', ['inquiries', 'referrals', 'admits', 'discharges']),
      supabase.from('daily_operations')
        .select('unit_id, mcr_full_days, mcr_co_days, mcr_lifetime_days, hmo_pt_days, medicaid_pt_days, commercial_pt_days, private_pay_pt_days, charity_indigent_pt_days, elmhs_pt_days')
        .eq('date', reportDate),
    ]);

    if (facilitiesRes.error) throw facilitiesRes.error;
    if (unitsRes.error) throw unitsRes.error;
    if (entriesRes.error) throw entriesRes.error;
    if (opsRes.error) throw opsRes.error;

    const facilities = facilitiesRes.data || [];
    const units = unitsRes.data || [];
    const entries = entriesRes.data || [];
    const opsData = opsRes.data || [];

    // Build census lookup by unit_id
    const censusByUnit: Record<string, number> = {};
    for (const op of opsData) {
      const census = (op.mcr_full_days || 0) + (op.mcr_co_days || 0) + (op.mcr_lifetime_days || 0) +
        (op.hmo_pt_days || 0) + (op.medicaid_pt_days || 0) + (op.commercial_pt_days || 0) +
        (op.private_pay_pt_days || 0) + (op.charity_indigent_pt_days || 0) + (op.elmhs_pt_days || 0);
      censusByUnit[op.unit_id] = (censusByUnit[op.unit_id] || 0) + census;
    }

    console.log(`Found ${entries.length} service dev entries for ${reportDate}`);

    // Build report data
    const reportData: FacilityData[] = [];

    for (const facility of facilities) {
      const facilityUnits = units.filter(u => u.facility_id === facility.id);
      const unitDataList: UnitData[] = [];
      const facilityTotals: TerritoryMetrics = { inquiries: 0, referrals: 0, admits: 0, discharges: 0 };
      let facilityCensus = 0;

      for (const unit of facilityUnits) {
        const unitEntries = entries.filter(e => e.unit_id === unit.id);
        if (unitEntries.length === 0) continue;

        const territories: Record<string, TerritoryMetrics> = {};
        const unitTotals: TerritoryMetrics = { inquiries: 0, referrals: 0, admits: 0, discharges: 0 };

        for (const entry of unitEntries) {
          const t = entry.territory;
          if (!territories[t]) {
            territories[t] = { inquiries: 0, referrals: 0, admits: 0, discharges: 0 };
          }
          const metric = entry.metric_name as keyof TerritoryMetrics;
          const val = Number(entry.numeric_value) || 0;
          territories[t][metric] += val;
          unitTotals[metric] += val;
        }

        facilityTotals.inquiries += unitTotals.inquiries;
        facilityTotals.referrals += unitTotals.referrals;
        facilityTotals.admits += unitTotals.admits;
        facilityTotals.discharges += unitTotals.discharges;

        const unitCensus = censusByUnit[unit.id] || 0;
        facilityCensus += unitCensus;

        unitDataList.push({
          unit_name: unit.name,
          territories,
          totals: { ...unitTotals, ref_admit_ratio: ratio(unitTotals.referrals, unitTotals.admits) },
          census: unitCensus,
        });
      }

      reportData.push({
        facility_name: facility.name,
        facility_code: facility.code,
        units: unitDataList,
        totals: { ...facilityTotals, ref_admit_ratio: ratio(facilityTotals.referrals, facilityTotals.admits) },
        census: facilityCensus,
      });
    }

    const htmlContent = generateHtml(reportData, reportDate);

    console.log("Sending email via Resend...");
    const emailResponse = await resend.emails.send({
      from: "Freedom Healthcare <noreply@freedom.v8techco.com>",
      to: ["jreed@freedomhc.com", "broberts@freedomhc.com"],
      subject: `Daily Service Development Report - ${reportDate}`,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Service Development report sent successfully",
        emailId: emailResponse.data?.id,
        facilitiesIncluded: reportData.length,
        entriesFound: entries.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending Service Development report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
