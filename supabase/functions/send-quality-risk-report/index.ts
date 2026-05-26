import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QualityRiskData {
  facility_name: string;
  facility_code: string;
  units: {
    unit_name: string;
    date: string;
    late_hp: number;
    late_initial_treatment_plans: number;
    late_psych_evals: number;
    late_dc_summaries: number;
    falls_with_injury: number;
    falls_without_injury: number;
    incident_report_with_injury: number;
    incident_report_without_injury: number;
    medication_variance: number;
    hospital_transfers_returned: number;
    hospital_transfers_not_returned: number;
    restraints: number;
    seclusions: number;
    complaints: number;
    grievances: number;
    dc_against_medical_advice: number;
    safety_rounds: number;
    admin_chart_audits: number;
    nursing_chart_audits: number;
    clinical_chart_audits: number;
    quality_chart_audits: number;
    charts_requested: number;
    appeals_sent: number;
    rac_zpic_audits_open: number;
    mtp_signed_by_md: number;
    initial_cert: number;
    recert: number;
    internal_dc_surveys_executed: number;
    deficiency_reports_to_dept_head: boolean;
    late_quality_why: string | null;
    internal_dc_surveys_why: string | null;
    initial_cert_why: string | null;
    deficiency_reports_why: string | null;
    comments_quality_risk: string | null;
  }[];
}

function generateHtmlReport(data: QualityRiskData[], reportDate: string): string {
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; font-size: 14px; color: #333; }
        h1 { color: #1a365d; }
        h2 { color: #2c5282; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; }
        h3 { color: #4a5568; margin-top: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
        th { background-color: #f7fafc; font-weight: 600; }
        tr:nth-child(even) { background-color: #f9fafb; }
        .highlight { color: #e53e3e; font-weight: 600; }
        .section { margin-bottom: 30px; }
        .comment-box { background-color: #fff5f5; border-left: 4px solid #fc8181; padding: 10px 15px; margin: 10px 0; }
        .no-data { color: #718096; font-style: italic; }
      </style>
    </head>
    <body>
      <h1>Daily Quality Risk Events Report</h1>
      <p><strong>Report Date:</strong> ${reportDate}</p>
      <p><strong>Generated:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })}</p>
  `;

  if (data.length === 0) {
    html += `<p class="no-data">No quality risk data found for today.</p>`;
  } else {
    for (const facility of data) {
      html += `
        <div class="section">
          <h2>${facility.facility_name} (${facility.facility_code})</h2>
      `;

      if (facility.units.length === 0) {
        html += `<p class="no-data">No entries submitted for this facility today.</p>`;
      } else {
        for (const unit of facility.units) {
          html += `
            <h3>${unit.unit_name}</h3>
            <table>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
              <tr><td>Late H&P</td><td class="${unit.late_hp > 0 ? 'highlight' : ''}">${unit.late_hp}</td></tr>
              <tr><td>Late Initial Treatment Plans</td><td class="${unit.late_initial_treatment_plans > 0 ? 'highlight' : ''}">${unit.late_initial_treatment_plans}</td></tr>
              <tr><td>Late Psych Evals</td><td class="${unit.late_psych_evals > 0 ? 'highlight' : ''}">${unit.late_psych_evals}</td></tr>
              <tr><td>Late DC Summaries</td><td class="${unit.late_dc_summaries > 0 ? 'highlight' : ''}">${unit.late_dc_summaries}</td></tr>
              <tr><td>Falls w/ Injury</td><td class="${unit.falls_with_injury > 0 ? 'highlight' : ''}">${unit.falls_with_injury}</td></tr>
              <tr><td>Falls w/o Injury</td><td>${unit.falls_without_injury}</td></tr>
              <tr><td>Incident Report w/ Injury</td><td class="${unit.incident_report_with_injury > 0 ? 'highlight' : ''}">${unit.incident_report_with_injury}</td></tr>
              <tr><td>Incident Report w/o Injury</td><td>${unit.incident_report_without_injury}</td></tr>
              <tr><td>Medication Variance</td><td class="${unit.medication_variance > 0 ? 'highlight' : ''}">${unit.medication_variance}</td></tr>
              <tr><td>Hospital Transfers (returned)</td><td>${unit.hospital_transfers_returned}</td></tr>
              <tr><td>Hospital Transfers (not returned)</td><td class="${unit.hospital_transfers_not_returned > 0 ? 'highlight' : ''}">${unit.hospital_transfers_not_returned}</td></tr>
              <tr><td>Restraints</td><td class="${unit.restraints > 0 ? 'highlight' : ''}">${unit.restraints}</td></tr>
              <tr><td>Seclusions</td><td class="${unit.seclusions > 0 ? 'highlight' : ''}">${unit.seclusions}</td></tr>
              <tr><td>Complaints</td><td class="${unit.complaints > 0 ? 'highlight' : ''}">${unit.complaints}</td></tr>
              <tr><td>Grievances</td><td class="${unit.grievances > 0 ? 'highlight' : ''}">${unit.grievances}</td></tr>
              <tr><td>D/C Against Medical Advice</td><td class="${unit.dc_against_medical_advice > 0 ? 'highlight' : ''}">${unit.dc_against_medical_advice}</td></tr>
              <tr><td>Safety Rounds</td><td>${unit.safety_rounds}</td></tr>
              <tr><td>Admin Chart Audits</td><td>${unit.admin_chart_audits}</td></tr>
              <tr><td>Nursing Chart Audits</td><td>${unit.nursing_chart_audits}</td></tr>
              <tr><td>Clinical Chart Audits</td><td>${unit.clinical_chart_audits}</td></tr>
              <tr><td>Quality Chart Audits</td><td>${unit.quality_chart_audits}</td></tr>
              <tr><td>Charts Requested</td><td>${unit.charts_requested}</td></tr>
              <tr><td>Appeals Sent</td><td>${unit.appeals_sent}</td></tr>
              <tr><td>RAC/ZPIC Audits Open</td><td>${unit.rac_zpic_audits_open}</td></tr>
              <tr><td>MTP Signed by MD</td><td>${unit.mtp_signed_by_md}</td></tr>
              <tr><td>Initial Cert</td><td>${unit.initial_cert}</td></tr>
              <tr><td>Recert</td><td>${unit.recert}</td></tr>
              <tr><td>Internal D/C Surveys Executed</td><td>${unit.internal_dc_surveys_executed}</td></tr>
              <tr><td>Deficiency Reports to Dept Head</td><td class="${!unit.deficiency_reports_to_dept_head ? 'highlight' : ''}">${unit.deficiency_reports_to_dept_head ? 'Yes' : 'No'}</td></tr>
            </table>
          `;

          // Add why comments if present
          if (unit.late_quality_why) {
            html += `<div class="comment-box"><strong>Late Entries Explanation:</strong> ${unit.late_quality_why}</div>`;
          }
          if (unit.internal_dc_surveys_why) {
            html += `<div class="comment-box"><strong>D/C Surveys Explanation:</strong> ${unit.internal_dc_surveys_why}</div>`;
          }
          if (unit.initial_cert_why) {
            html += `<div class="comment-box"><strong>Initial Cert Explanation:</strong> ${unit.initial_cert_why}</div>`;
          }
          if (unit.deficiency_reports_why) {
            html += `<div class="comment-box"><strong>Deficiency Reports Explanation:</strong> ${unit.deficiency_reports_why}</div>`;
          }
          if (unit.comments_quality_risk) {
            html += `<div class="comment-box"><strong>Additional Comments:</strong> ${unit.comments_quality_risk}</div>`;
          }
        }
      }

      html += `</div>`;
    }
  }

  html += `
      <hr style="margin-top: 40px; border: none; border-top: 1px solid #e2e8f0;">
      <p style="color: #718096; font-size: 12px;">This is an automated report from Freedom Healthcare Operations System.</p>
    </body>
    </html>
  `;

  return html;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting Quality Risk Events report generation...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for custom date in request body, otherwise use today's date in Central Time
    let reportDate: string;
    try {
      const body = await req.json();
      if (body?.date) {
        reportDate = body.date;
        console.log(`Using custom date from request: ${reportDate}`);
      } else {
        // Default to yesterday's date in Central Time for complete data
        const now = new Date();
        const centralTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
        centralTime.setDate(centralTime.getDate() - 1);
        reportDate = centralTime.toISOString().split('T')[0];
      }
    } catch {
      // Fallback to yesterday's date in Central Time
      const now = new Date();
      const centralTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      centralTime.setDate(centralTime.getDate() - 1);
      reportDate = centralTime.toISOString().split('T')[0];
    }
    
    console.log(`Fetching data for date: ${reportDate}`);

    // Fetch all facilities
    const { data: facilities, error: facilityError } = await supabase
      .from('facilities')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    if (facilityError) {
      throw new Error(`Failed to fetch facilities: ${facilityError.message}`);
    }

    console.log(`Found ${facilities?.length || 0} facilities`);

    // Fetch all units
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, name, facility_id, unit_type')
      .eq('is_active', true);

    if (unitsError) {
      throw new Error(`Failed to fetch units: ${unitsError.message}`);
    }

    // Fetch today's daily operations data
    const { data: dailyOps, error: opsError } = await supabase
      .from('daily_operations')
      .select(`
        unit_id,
        date,
        late_hp,
        late_initial_treatment_plans,
        late_psych_evals,
        late_dc_summaries,
        falls_with_injury,
        falls_without_injury,
        incident_report_with_injury,
        incident_report_without_injury,
        medication_variance,
        hospital_transfers_returned,
        hospital_transfers_not_returned,
        restraints,
        seclusions,
        complaints,
        grievances,
        dc_against_medical_advice,
        safety_rounds,
        admin_chart_audits,
        nursing_chart_audits,
        clinical_chart_audits,
        quality_chart_audits,
        charts_requested,
        appeals_sent,
        rac_zpic_audits_open,
        mtp_signed_by_md,
        initial_cert,
        recert,
        internal_dc_surveys_executed,
        deficiency_reports_to_dept_head,
        late_quality_why,
        internal_dc_surveys_why,
        initial_cert_why,
        deficiency_reports_why,
        comments_quality_risk
      `)
      .eq('date', reportDate);

    if (opsError) {
      throw new Error(`Failed to fetch daily operations: ${opsError.message}`);
    }

    console.log(`Found ${dailyOps?.length || 0} daily operations entries for today`);

    // Build report data structure
    const reportData: QualityRiskData[] = [];

    for (const facility of facilities || []) {
      const facilityUnits = (units || []).filter(u => u.facility_id === facility.id && u.unit_type !== 'IOP');
      const unitData: QualityRiskData['units'] = [];

      for (const unit of facilityUnits) {
        const ops = (dailyOps || []).find(o => o.unit_id === unit.id);
        if (ops) {
          unitData.push({
            unit_name: unit.name,
            date: ops.date,
            late_hp: ops.late_hp || 0,
            late_initial_treatment_plans: ops.late_initial_treatment_plans || 0,
            late_psych_evals: ops.late_psych_evals || 0,
            late_dc_summaries: ops.late_dc_summaries || 0,
            falls_with_injury: ops.falls_with_injury || 0,
            falls_without_injury: ops.falls_without_injury || 0,
            incident_report_with_injury: ops.incident_report_with_injury || 0,
            incident_report_without_injury: ops.incident_report_without_injury || 0,
            medication_variance: ops.medication_variance || 0,
            hospital_transfers_returned: ops.hospital_transfers_returned || 0,
            hospital_transfers_not_returned: ops.hospital_transfers_not_returned || 0,
            restraints: ops.restraints || 0,
            seclusions: ops.seclusions || 0,
            complaints: ops.complaints || 0,
            grievances: ops.grievances || 0,
            dc_against_medical_advice: ops.dc_against_medical_advice || 0,
            safety_rounds: ops.safety_rounds || 0,
            admin_chart_audits: ops.admin_chart_audits || 0,
            nursing_chart_audits: ops.nursing_chart_audits || 0,
            clinical_chart_audits: ops.clinical_chart_audits || 0,
            quality_chart_audits: ops.quality_chart_audits || 0,
            charts_requested: ops.charts_requested || 0,
            appeals_sent: ops.appeals_sent || 0,
            rac_zpic_audits_open: ops.rac_zpic_audits_open || 0,
            mtp_signed_by_md: ops.mtp_signed_by_md || 0,
            initial_cert: ops.initial_cert || 0,
            recert: ops.recert || 0,
            internal_dc_surveys_executed: ops.internal_dc_surveys_executed || 0,
            deficiency_reports_to_dept_head: ops.deficiency_reports_to_dept_head !== false,
            late_quality_why: ops.late_quality_why,
            internal_dc_surveys_why: ops.internal_dc_surveys_why,
            initial_cert_why: ops.initial_cert_why,
            deficiency_reports_why: ops.deficiency_reports_why,
            comments_quality_risk: ops.comments_quality_risk,
          });
        }
      }

      reportData.push({
        facility_name: facility.name,
        facility_code: facility.code,
        units: unitData,
      });
    }

    // Generate HTML email
    const htmlContent = generateHtmlReport(reportData, reportDate);

    // Send email via Resend
    console.log("Sending email via Resend...");
    const emailResponse = await resend.emails.send({
      from: "Freedom Healthcare <noreply@freedom.v8techco.com>",
      to: ["schisholm@freedomhc.com"],
      subject: `Daily Quality Risk Events Report - ${reportDate}`,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Quality Risk Events report sent successfully",
        emailId: emailResponse.data?.id,
        facilitiesIncluded: reportData.length,
        entriesFound: dailyOps?.length || 0
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending Quality Risk Events report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
