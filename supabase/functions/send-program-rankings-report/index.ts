import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const JOTFORM_FORM_ID = '242603376879165';
// HIPAA-enabled Jotform accounts must use the dedicated endpoint.
const JOTFORM_API_BASE = 'https://hipaa-api.jotform.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type ProgramType = 'INPATIENT' | 'IOP';

type FacilityRecord = {
  id: string;
  name: string;
  code: string;
};

type UnitRecord = {
  id: string;
  name: string;
  facility_id: string;
  unit_type: string;
};

type ProgramRankingDailyActualRecord = {
  facility_id: string;
  unit_id: string;
  date: string;
  actual_value: number | null;
};

type DailyOperationsActualRecord = {
  facility_id: string;
  unit_id: string;
  iop_daily_enrolled_total: number | null;
  mcr_full_days: number | null;
  mcr_co_days: number | null;
  mcr_lifetime_days: number | null;
  hmo_pt_days: number | null;
  medicaid_pt_days: number | null;
  commercial_pt_days: number | null;
  private_pay_pt_days: number | null;
  charity_indigent_pt_days: number | null;
};

type BudgetRowRecord = {
  id: string;
  row_key: string;
};

type BudgetRecord = {
  unit_id: string;
  row_id: string;
  month: number;
  value: number | null;
};

type RankingMetricSet = {
  budget: number;
  actual: number;
  variance: number;
};

type ProgramRankingRow = {
  rank: number;
  facilityName: string;
  unitName: string;
  daily: RankingMetricSet;
  mtd: RankingMetricSet;
  ytd: RankingMetricSet;
};

const BUDGET_ROW_KEYS = [
  'pt_days',
  'days_in_month',
  'other_patient_days',
  'adc',
  'other_adc',
  'total_adc',
  'iop_total_visits',
  'iop_weekdays',
  'iop_ada',
] as const;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function formatDateParts(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return { year, month, day };
}

function createUtcDate(dateString: string) {
  const { year, month, day } = formatDateParts(dateString);
  return new Date(Date.UTC(year, month - 1, day));
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDate(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfYear(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function differenceInCalendarDays(left: Date, right: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((left.getTime() - right.getTime()) / millisecondsPerDay);
}

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function previousFriday(date: Date) {
  const previous = new Date(date);
  while (previous.getUTCDay() !== 5) {
    previous.setUTCDate(previous.getUTCDate() - 1);
  }
  return previous;
}

function getBusinessDate(input: Date) {
  return isWeekend(input) ? previousFriday(input) : input;
}

function numberOrZero(value: number | null | undefined) {
  return Number(value || 0);
}

function calculateDailyActualFromSnapshots(rows: ProgramRankingDailyActualRecord[]) {
  if (rows.length === 0) return 0;
  return rows.reduce((total, row) => total + numberOrZero(row.actual_value), 0);
}

function calculateAverageDailyActualFromSnapshots(rows: ProgramRankingDailyActualRecord[]) {
  if (rows.length === 0) return 0;
  const totalsByDate = new Map<string, number>();

  for (const row of rows) {
    totalsByDate.set(row.date, (totalsByDate.get(row.date) || 0) + numberOrZero(row.actual_value));
  }

  if (totalsByDate.size === 0) return 0;
  const total = Array.from(totalsByDate.values()).reduce((sum, value) => sum + value, 0);
  return total / totalsByDate.size;
}

function calculateDailyOperationsActual(row: DailyOperationsActualRecord, unitType: string) {
  if (unitType === 'IOP') {
    return numberOrZero(row.iop_daily_enrolled_total);
  }

  return (
    numberOrZero(row.mcr_full_days)
    + numberOrZero(row.mcr_co_days)
    + numberOrZero(row.mcr_lifetime_days)
    + numberOrZero(row.hmo_pt_days)
    + numberOrZero(row.medicaid_pt_days)
    + numberOrZero(row.commercial_pt_days)
    + numberOrZero(row.private_pay_pt_days)
    + numberOrZero(row.charity_indigent_pt_days)
  );
}

function createMetricSet(budget: number, actual: number): RankingMetricSet {
  return { budget, actual, variance: actual - budget };
}

function getApplicableDaysForMonth(year: number, month: number, asOfDate: Date) {
  const asOfMonth = asOfDate.getUTCMonth() + 1;
  if (month > asOfMonth) return 0;
  if (month < asOfMonth) return getDaysInMonth(year, month);
  return differenceInCalendarDays(asOfDate, startOfMonth(asOfDate)) + 1;
}

function calculateYtdBudget(monthlyBudgetMap: Map<number, number>, asOfDate: Date) {
  const year = asOfDate.getUTCFullYear();
  let weightedTotal = 0;
  let totalDays = 0;

  for (let month = 1; month <= asOfDate.getUTCMonth() + 1; month += 1) {
    const applicableDays = getApplicableDaysForMonth(year, month, asOfDate);
    if (applicableDays === 0) continue;
    weightedTotal += (monthlyBudgetMap.get(month) || 0) * applicableDays;
    totalDays += applicableDays;
  }

  return totalDays > 0 ? weightedTotal / totalDays : 0;
}

function safeDivide(numerator?: number, denominator?: number) {
  if (numerator === undefined || denominator === undefined || denominator === 0) return undefined;
  return numerator / denominator;
}

function buildBudgetValueContext(budgets: BudgetRecord[], budgetRowsById: Map<string, string>) {
  const lookup = new Map<string, Map<string, Map<number, number>>>();

  for (const budget of budgets) {
    const rowKey = budgetRowsById.get(budget.row_id);
    if (!rowKey) continue;

    const unitLookup = lookup.get(budget.unit_id) || new Map<string, Map<number, number>>();
    const monthlyMap = unitLookup.get(rowKey) || new Map<number, number>();

    monthlyMap.set(budget.month, numberOrZero(budget.value));
    unitLookup.set(rowKey, monthlyMap);
    lookup.set(budget.unit_id, unitLookup);
  }

  return lookup;
}

function getBudgetValue(budgetContext: Map<string, Map<string, Map<number, number>>>, unitId: string, rowKey: string, month: number) {
  return budgetContext.get(unitId)?.get(rowKey)?.get(month);
}

function deriveInpatientMonthlyBudget(budgetContext: Map<string, Map<string, Map<number, number>>>, unitId: string, month: number) {
  const storedTotalAdc = getBudgetValue(budgetContext, unitId, 'total_adc', month);
  if (storedTotalAdc !== undefined) return storedTotalAdc;

  const storedAdc = getBudgetValue(budgetContext, unitId, 'adc', month);
  const storedOtherAdc = getBudgetValue(budgetContext, unitId, 'other_adc', month);
  if (storedAdc !== undefined || storedOtherAdc !== undefined) {
    return (storedAdc || 0) + (storedOtherAdc || 0);
  }

  const daysInMonth = getBudgetValue(budgetContext, unitId, 'days_in_month', month);
  const adc = safeDivide(getBudgetValue(budgetContext, unitId, 'pt_days', month), daysInMonth);
  const otherAdc = safeDivide(getBudgetValue(budgetContext, unitId, 'other_patient_days', month), daysInMonth);

  if (adc !== undefined || otherAdc !== undefined) {
    return (adc || 0) + (otherAdc || 0);
  }

  return 0;
}

function deriveIopMonthlyBudget(budgetContext: Map<string, Map<string, Map<number, number>>>, unitId: string, month: number) {
  const storedAda = getBudgetValue(budgetContext, unitId, 'iop_ada', month);
  if (storedAda !== undefined) return storedAda;

  return safeDivide(getBudgetValue(budgetContext, unitId, 'iop_total_visits', month), getBudgetValue(budgetContext, unitId, 'iop_weekdays', month)) || 0;
}

function buildDerivedBudgetLookup(
  unitIds: string[],
  budgetContext: Map<string, Map<string, Map<number, number>>>,
  deriveMonthlyBudget: (budgetContext: Map<string, Map<string, Map<number, number>>>, unitId: string, month: number) => number,
) {
  const lookup = new Map<string, Map<number, number>>();

  for (const unitId of unitIds) {
    const monthlyMap = new Map<number, number>();
    for (let month = 1; month <= 12; month += 1) {
      monthlyMap.set(month, deriveMonthlyBudget(budgetContext, unitId, month));
    }
    lookup.set(unitId, monthlyMap);
  }

  return lookup;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMetric(value: number) {
  return value.toFixed(2);
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function varianceClassName(value: number) {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

function buildTableRows(rows: ProgramRankingRow[]) {
  if (rows.length === 0) {
    return '<tr><td colspan="12" class="empty">No ranking data available.</td></tr>';
  }

  return rows.map((row) => `
    <tr>
      <td class="rank">#${row.rank}</td>
      <td>${escapeHtml(row.facilityName)}</td>
      <td>${escapeHtml(row.unitName)}</td>
      <td class="num">${formatMetric(row.daily.budget)}</td>
      <td class="num">${formatMetric(row.daily.actual)}</td>
      <td class="num ${varianceClassName(row.daily.variance)}">${formatMetric(row.daily.variance)}</td>
      <td class="num">${formatMetric(row.mtd.budget)}</td>
      <td class="num">${formatMetric(row.mtd.actual)}</td>
      <td class="num ${varianceClassName(row.mtd.variance)}">${formatMetric(row.mtd.variance)}</td>
      <td class="num">${formatMetric(row.ytd.budget)}</td>
      <td class="num">${formatMetric(row.ytd.actual)}</td>
      <td class="num ${varianceClassName(row.ytd.variance)}">${formatMetric(row.ytd.variance)}</td>
    </tr>
  `).join('');
}

type JotformAggregate = {
  fieldId: string;
  label: string;
  count: number;
  sum: number;
  average: number;
};

type JotformSummary = {
  submissionCount: number;
  windowStart: string;
  windowEnd: string;
  aggregates: JotformAggregate[];
  error?: string;
};

function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

async function fetchJotformSummary(asOfDate: Date): Promise<JotformSummary | null> {
  const apiKey = Deno.env.get('JOTFORM_API_KEY');
  if (!apiKey) {
    console.warn('JOTFORM_API_KEY not configured; skipping Jotform section.');
    return null;
  }

  const end = new Date(asOfDate);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(asOfDate);
  start.setUTCDate(start.getUTCDate() - 29);
  start.setUTCHours(0, 0, 0, 0);

  // Note: Jotform's `filter` param with `created_at:gt` is unreliable across accounts.
  // Instead, fetch the most recent submissions ordered desc and filter in code.
  const url = `${JOTFORM_API_BASE}/form/${JOTFORM_FORM_ID}/submissions?apiKey=${encodeURIComponent(apiKey)}&limit=1000&orderby=created_at`;
  const redactedUrl = url.replace(apiKey, '***');
  console.log(`[jotform] GET ${redactedUrl}`);
  console.log(`[jotform] window: ${start.toISOString()} -> ${end.toISOString()}`);

  try {
    const res = await fetch(url);
    console.log(`[jotform] HTTP ${res.status}`);
    if (!res.ok) {
      const body = await res.text();
      console.error(`Jotform API error [${res.status}]: ${body}`);
      return {
        submissionCount: 0,
        windowStart: start.toISOString().slice(0, 10),
        windowEnd: end.toISOString().slice(0, 10),
        aggregates: [],
        error: `Jotform API returned ${res.status}`,
      };
    }
    const json = await res.json();
    const allSubmissions: any[] = Array.isArray(json?.content) ? json.content : [];
    console.log(`[jotform] resultSet:`, JSON.stringify(json?.resultSet ?? {}));
    console.log(`[jotform] total submissions returned: ${allSubmissions.length}`);
    if (allSubmissions[0]) {
      console.log(`[jotform] sample created_at: ${allSubmissions[0].created_at}`);
      console.log(`[jotform] sample answer keys: ${Object.keys(allSubmissions[0].answers ?? {}).join(',')}`);
    }

    // Filter to the rolling 30-day window in code.
    const startMs = start.getTime();
    const endMs = end.getTime();
    const submissions = allSubmissions.filter((s) => {
      const t = Date.parse((s?.created_at ?? '').replace(' ', 'T') + 'Z');
      return Number.isFinite(t) && t >= startMs && t <= endMs;
    });
    console.log(`[jotform] submissions within window: ${submissions.length}`);

    // Aggregate numeric answers across submissions.
    const buckets = new Map<string, { label: string; values: number[] }>();
    for (const sub of submissions) {
      const answers = sub?.answers ?? {};
      for (const [qid, raw] of Object.entries<any>(answers)) {
        const label = raw?.text || raw?.name || `Field ${qid}`;
        const answerValue = raw?.answer;
        const num = parseNumeric(answerValue);
        if (num === null) continue;
        if (!buckets.has(qid)) buckets.set(qid, { label, values: [] });
        buckets.get(qid)!.values.push(num);
      }
    }

    const aggregates: JotformAggregate[] = [];
    for (const [fieldId, { label, values }] of buckets.entries()) {
      if (values.length < 1) continue;
      const sum = values.reduce((a, b) => a + b, 0);
      aggregates.push({
        fieldId,
        label,
        count: values.length,
        sum,
        average: sum / values.length,
      });
    }
    aggregates.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    console.log(`[jotform] numeric aggregate fields: ${aggregates.length}`);

    return {
      submissionCount: submissions.length,
      windowStart: start.toISOString().slice(0, 10),
      windowEnd: end.toISOString().slice(0, 10),
      aggregates,
    };
  } catch (err) {
    console.error('Failed to fetch Jotform submissions:', err);
    return {
      submissionCount: 0,
      windowStart: start.toISOString().slice(0, 10),
      windowEnd: end.toISOString().slice(0, 10),
      aggregates: [],
      error: err instanceof Error ? err.message : 'Unknown Jotform error',
    };
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function renderJotformSection(summary: JotformSummary | null): string {
  if (!summary) return '';
  const header = `
    <section>
      <h2>Jotform Submissions (Last 30 Days)</h2>
      <p><strong>Window:</strong> ${escapeHtml(summary.windowStart)} &rarr; ${escapeHtml(summary.windowEnd)}</p>
      <p><strong>Total submissions:</strong> ${summary.submissionCount}</p>
  `;
  if (summary.error) {
    return `${header}<p style="color:#b91c1c;">Unable to load Jotform data: ${escapeHtml(summary.error)}</p></section>`;
  }
  if (summary.aggregates.length === 0) {
    return `${header}<p>No numeric fields available to aggregate.</p></section>`;
  }
  const rows = summary.aggregates.map((a) => `
    <tr>
      <td>${escapeHtml(a.label)}</td>
      <td class="num">${a.count}</td>
      <td class="num">${escapeHtml(formatNumber(a.sum))}</td>
      <td class="num">${escapeHtml(formatNumber(a.average))}</td>
    </tr>
  `).join('');
  return `
    ${header}
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th class="num">Responses</th>
            <th class="num">Sum</th>
            <th class="num">Average</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function generateHtmlEmail(
  asOfDate: Date,
  inpatientRankings: ProgramRankingRow[],
  iopRankings: ProgramRankingRow[],
  jotformSummary: JotformSummary | null,
) {
  const generatedAt = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

  const renderSection = (title: string, rows: ProgramRankingRow[]) => `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>HOSP</th>
            <th>Unit</th>
            <th>Day Budget</th>
            <th>Day Actual</th>
            <th>Day Variance</th>
            <th>MTD Budget</th>
            <th>MTD Actual</th>
            <th>MTD Variance</th>
            <th>YTD Budget</th>
            <th>YTD Actual</th>
            <th>YTD Variance</th>
          </tr>
        </thead>
        <tbody>${buildTableRows(rows)}</tbody>
      </table>
    </section>
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; }
          h1 { color: #0f172a; margin-bottom: 8px; }
          h2 { color: #1e293b; margin: 28px 0 12px; }
          p { margin: 4px 0; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
          th { background: #f8fafc; text-align: left; }
          td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
          td.rank { font-weight: 700; }
          td.positive { color: #166534; font-weight: 600; }
          td.negative { color: #b91c1c; font-weight: 600; }
          td.neutral { color: #64748b; font-weight: 600; }
          td.empty { text-align: center; color: #64748b; padding: 20px; }
          .meta { margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Program Rankings Report</h1>
        <div class="meta">
          <p><strong>As of:</strong> ${escapeHtml(formatDisplayDate(asOfDate))}</p>
          <p><strong>Generated:</strong> ${escapeHtml(generatedAt)}</p>
        </div>
        ${renderSection('Inpatient Program Rankings', inpatientRankings)}
        ${renderSection('Intensive Outpatient Unit Rankings', iopRankings)}
        ${renderJotformSection(jotformSummary)}
      </body>
    </html>
  `;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    let body: { date?: string; debug?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    // Debug short-circuit: returns Jotform diagnostics without sending email.
    if (body.debug === 'jotform') {
      const debugDate = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? createUtcDate(body.date)
        : new Date();
      const summary = await fetchJotformSummary(debugDate);
      // Also probe the API key's account-level access to surface permission issues.
      const apiKey = Deno.env.get('JOTFORM_API_KEY') ?? '';
      let accountProbe: any = { skipped: true };
      if (apiKey) {
        try {
          const formsRes = await fetch(`${JOTFORM_API_BASE}/user/forms?apiKey=${encodeURIComponent(apiKey)}&limit=20`);
          const formsJson: any = await formsRes.json();
          const forms = Array.isArray(formsJson?.content) ? formsJson.content : [];
          accountProbe = {
            status: formsRes.status,
            visibleFormCount: forms.length,
            forms: forms.map((f: any) => ({ id: f.id, title: f.title, count: f.count })),
            targetFormVisible: forms.some((f: any) => String(f.id) === JOTFORM_FORM_ID),
          };
          // Probe the user account itself
          try {
            const userRes = await fetch(`${JOTFORM_API_BASE}/user?apiKey=${encodeURIComponent(apiKey)}`);
            const userJson: any = await userRes.json();
            accountProbe.user = {
              status: userRes.status,
              username: userJson?.content?.username,
              email: userJson?.content?.email,
              accountType: userJson?.content?.account_type?.name,
              status_field: userJson?.content?.status,
              message: userJson?.message,
            };
          } catch (e) {
            accountProbe.user = { error: e instanceof Error ? e.message : 'user probe failed' };
          }
          // Probe direct access to the target form
          try {
            const formRes = await fetch(`${JOTFORM_API_BASE}/form/${JOTFORM_FORM_ID}?apiKey=${encodeURIComponent(apiKey)}`);
            const formJson: any = await formRes.json();
            accountProbe.targetForm = {
              status: formRes.status,
              responseCode: formJson?.responseCode,
              message: formJson?.message,
              id: formJson?.content?.id,
              title: formJson?.content?.title,
              count: formJson?.content?.count,
              username: formJson?.content?.username,
            };
          } catch (e) {
            accountProbe.targetForm = { error: e instanceof Error ? e.message : 'form probe failed' };
          }
        } catch (e) {
          accountProbe = { error: e instanceof Error ? e.message : 'probe failed' };
        }
      }
      return json({ debug: 'jotform', asOf: debugDate.toISOString().slice(0, 10), targetFormId: JOTFORM_FORM_ID, summary, accountProbe });
    }

    const rawDate = body.date?.trim();
    if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      return json({ error: 'A valid date is required.' }, 400);
    }

    const requestedDate = createUtcDate(rawDate);
    if (Number.isNaN(requestedDate.getTime())) {
      return json({ error: 'Invalid report date.' }, 400);
    }

    const asOfDate = getBusinessDate(requestedDate);
    const asOfDateString = formatDate(asOfDate);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Backend configuration is incomplete.' }, 500);
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email ?? null;
    if (!userEmail) {
      return json({ error: 'Unable to determine your email address.' }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [accessSettingsResult, assignmentsResult, facilitiesResult, unitsResult, budgetRowsResult, budgetYearResult, actualSnapshotsResult, selectedDayDailyOpsResult] = await Promise.all([
      supabaseAdmin.from('user_access_settings').select('can_view_all_facilities').eq('user_id', userId).maybeSingle(),
      supabaseAdmin.from('user_facility_assignments').select('facility_id').eq('user_id', userId),
      supabaseAdmin.from('facilities').select('id, name, code').eq('is_active', true).order('name'),
      supabaseAdmin.from('units').select('id, name, facility_id, unit_type').eq('is_active', true),
      supabaseAdmin.from('budget_rows').select('id, row_key').in('row_key', [...BUDGET_ROW_KEYS]),
      supabaseAdmin.from('budget_years').select('id').eq('year', asOfDate.getUTCFullYear()).maybeSingle(),
      supabaseAdmin
        .from('program_ranking_daily_actuals')
        .select('facility_id, unit_id, date, actual_value')
        .gte('date', formatDate(startOfYear(asOfDate)))
        .lte('date', asOfDateString),
      supabaseAdmin
        .from('daily_operations')
        .select('facility_id, unit_id, iop_daily_enrolled_total, mcr_full_days, mcr_co_days, mcr_lifetime_days, hmo_pt_days, medicaid_pt_days, commercial_pt_days, private_pay_pt_days, charity_indigent_pt_days')
        .eq('date', asOfDateString),
    ]);

    if (accessSettingsResult.error) throw accessSettingsResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;
    if (facilitiesResult.error) throw facilitiesResult.error;
    if (unitsResult.error) throw unitsResult.error;
    if (budgetRowsResult.error) throw budgetRowsResult.error;
    if (budgetYearResult.error) throw budgetYearResult.error;
    if (actualSnapshotsResult.error) throw actualSnapshotsResult.error;
    if (selectedDayDailyOpsResult.error) throw selectedDayDailyOpsResult.error;

    const assignedFacilityIds = (assignmentsResult.data || []).map((assignment) => assignment.facility_id);
    const shouldViewAll = (accessSettingsResult.data?.can_view_all_facilities ?? false) || assignedFacilityIds.length === 0;
    const allowedFacilityIds = new Set(shouldViewAll ? (facilitiesResult.data || []).map((facility) => facility.id) : assignedFacilityIds);

    const accessibleFacilities = ((facilitiesResult.data || []) as FacilityRecord[]).filter((facility) => allowedFacilityIds.has(facility.id));
    const facilitiesById = new Map(accessibleFacilities.map((facility) => [facility.id, facility]));
    const accessibleUnits = ((unitsResult.data || []) as UnitRecord[]).filter((unit) => allowedFacilityIds.has(unit.facility_id));
    const unitsById = new Map(accessibleUnits.map((unit) => [unit.id, unit]));
    const inpatientUnits = accessibleUnits.filter((unit) => unit.unit_type === 'INPATIENT');
    const iopUnits = accessibleUnits.filter((unit) => unit.unit_type === 'IOP');
    const inpatientUnitIds = new Set(inpatientUnits.map((unit) => unit.id));
    const iopUnitIds = new Set(iopUnits.map((unit) => unit.id));

    const budgetRowsById = new Map(((budgetRowsResult.data || []) as BudgetRowRecord[]).map((row) => [row.id, row.row_key]));

    let budgets: BudgetRecord[] = [];
    if (budgetYearResult.data && accessibleUnits.length > 0) {
      const budgetsResult = await supabaseAdmin
        .from('budgets')
        .select('unit_id, row_id, month, value')
        .eq('budget_year_id', budgetYearResult.data.id)
        .in('unit_id', accessibleUnits.map((unit) => unit.id))
        .in('row_id', Array.from(budgetRowsById.keys()));

      if (budgetsResult.error) throw budgetsResult.error;
      budgets = (budgetsResult.data || []) as BudgetRecord[];
    }

    const budgetContext = buildBudgetValueContext(budgets, budgetRowsById);
    const inpatientBudgetLookup = buildDerivedBudgetLookup(inpatientUnits.map((unit) => unit.id), budgetContext, deriveInpatientMonthlyBudget);
    const iopBudgetLookup = buildDerivedBudgetLookup(iopUnits.map((unit) => unit.id), budgetContext, deriveIopMonthlyBudget);

    const actualSnapshots = ((actualSnapshotsResult.data || []) as ProgramRankingDailyActualRecord[]).filter((row) => allowedFacilityIds.has(row.facility_id) && unitsById.has(row.unit_id));
    const selectedDayFallbackActuals = new Map<string, number>(
      ((selectedDayDailyOpsResult.data || []) as DailyOperationsActualRecord[])
        .filter((row) => allowedFacilityIds.has(row.facility_id) && unitsById.has(row.unit_id))
        .map((row) => {
          const unitType = unitsById.get(row.unit_id)?.unit_type || 'INPATIENT';
          return [row.unit_id, calculateDailyOperationsActual(row, unitType)];
        }),
    );
    const mtdStart = formatDate(startOfMonth(asOfDate));
    const ytdRows = actualSnapshots;
    const mtdRows = actualSnapshots.filter((row) => row.date >= mtdStart);
    const dailyRows = actualSnapshots.filter((row) => row.date === asOfDateString);
    const currentMonth = asOfDate.getUTCMonth() + 1;

    const buildRankings = (programType: ProgramType) => {
      const relevantUnits = programType === 'INPATIENT' ? inpatientUnits : iopUnits;
      const relevantUnitIds = programType === 'INPATIENT' ? inpatientUnitIds : iopUnitIds;
      const budgetLookup = programType === 'INPATIENT' ? inpatientBudgetLookup : iopBudgetLookup;

      const rowsForProgram = {
        daily: dailyRows.filter((row) => relevantUnitIds.has(row.unit_id)),
        mtd: mtdRows.filter((row) => relevantUnitIds.has(row.unit_id)),
        ytd: ytdRows.filter((row) => relevantUnitIds.has(row.unit_id)),
      };

      return relevantUnits
        .map((unit) => {
          const facility = facilitiesById.get(unit.facility_id);
          if (!facility) return null;

          const monthlyBudgetMap = budgetLookup.get(unit.id) || new Map<number, number>();
          const unitDailyRows = rowsForProgram.daily.filter((row) => row.unit_id === unit.id);
          const unitMtdRows = rowsForProgram.mtd.filter((row) => row.unit_id === unit.id);
          const unitYtdRows = rowsForProgram.ytd.filter((row) => row.unit_id === unit.id);
          const snapshotDailyActual = calculateDailyActualFromSnapshots(unitDailyRows);
          const dailyActual = unitDailyRows.length > 0 ? snapshotDailyActual : (selectedDayFallbackActuals.get(unit.id) || 0);
          const mtdActual = calculateAverageDailyActualFromSnapshots(unitMtdRows);
          const ytdActual = calculateAverageDailyActualFromSnapshots(unitYtdRows);
          const currentMonthBudget = monthlyBudgetMap.get(currentMonth) || 0;
          const ytdBudget = calculateYtdBudget(monthlyBudgetMap, asOfDate);

          return {
            rank: 0,
            facilityName: facility.name,
            unitName: unit.name,
            daily: createMetricSet(currentMonthBudget, dailyActual),
            mtd: createMetricSet(currentMonthBudget, mtdActual),
            ytd: createMetricSet(ytdBudget, ytdActual),
          } satisfies ProgramRankingRow;
        })
        .filter((row): row is ProgramRankingRow => Boolean(row) && (
          row.daily.budget !== 0 ||
          row.daily.actual !== 0 ||
          row.mtd.actual !== 0 ||
          row.ytd.actual !== 0 ||
          row.ytd.budget !== 0
        ))
        .sort((a, b) => {
          if (b.ytd.variance !== a.ytd.variance) return b.ytd.variance - a.ytd.variance;
          if (b.mtd.variance !== a.mtd.variance) return b.mtd.variance - a.mtd.variance;
          if (a.facilityName !== b.facilityName) return a.facilityName.localeCompare(b.facilityName);
          return a.unitName.localeCompare(b.unitName);
        })
        .map((row, index) => ({ ...row, rank: index + 1 }));
    };

    const inpatientRankings = buildRankings('INPATIENT');
    const iopRankings = buildRankings('IOP');
    const jotformSummary = await fetchJotformSummary(asOfDate);
    const html = generateHtmlEmail(asOfDate, inpatientRankings, iopRankings, jotformSummary);

    const emailResponse = await resend.emails.send({
      from: 'Freedom Healthcare <noreply@freedom.v8techco.com>',
      to: [userEmail],
      subject: `Program Rankings Report - ${asOfDateString}`,
      html,
    });

    return json({
      success: true,
      message: `Program Rankings report emailed to ${userEmail}.`,
      emailId: emailResponse.data?.id,
      inpatientCount: inpatientRankings.length,
      iopCount: iopRankings.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending Program Rankings report:', error);
    return json({ error: message }, 500);
  }
});