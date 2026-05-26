# Facility Ops Dashboard — Template

A production-grade, multi-facility operations and financial management platform built with React, TypeScript, and Supabase. Purchase this template once and deploy it for any organization that needs budget tracking, daily operational reporting, role-based access control, and KPI dashboards.

---

## What's Included

| Feature | Description |
|---|---|
| **Multi-facility / multi-unit** | Manage any number of facilities and their sub-units |
| **Role-based access control** | 11 built-in roles, facility-level permission scoping |
| **Budget entry** | 12-month grid with 57 configurable sections, formula engine, CSV import/export |
| **Daily operations** | 150+ field daily log per unit — census, staffing, quality, revenue |
| **Daily actuals** | Day-by-day actual entry against budget targets |
| **KPI dashboard** | Admits performance, ADC, variance charts, program rankings |
| **Reports** | Budget vs Actual, KPI Summary, Program Rankings, Operations Summary |
| **Admin panel** | User management, facility/unit CRUD, compliance reports, audit log |
| **IOP program tracking** | Outpatient patient enrollment and attendance |
| **Service development** | Territory-based referral and admit tracking |
| **CSV & PDF export** | Every major view exports to CSV or PDF |
| **Dark mode** | Full dark/light theme via CSS variables |

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **UI:** Tailwind CSS, shadcn/ui (Radix UI primitives)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **State:** TanStack React Query
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod
- **Export:** jsPDF, jspdf-autotable, xlsx
- **Fonts:** Geist Sans / Geist Mono

---

## Quick Start

### 1. Clone and install

```bash
git clone <this-repo-url>
cd facility-ops-template
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **anon public key** from Settings → API.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_ANON_PUBLIC_KEY"
VITE_SUPABASE_PROJECT_ID="YOUR_PROJECT_ID"
```

### 4. Apply database migrations

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) then link to your project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_ID
supabase db push
```

This applies all 48 migrations in `supabase/migrations/` to create the full schema.

### 5. Seed the budget structure

After the app is running, sign in as an admin and go to **Admin → Seed Budget Structure** to populate the default budget sections and rows.

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

---

## Initial Setup in the App

### Create your first admin user

1. Go to `/auth` and sign up with your email.
2. In Supabase Dashboard → Authentication → Users, confirm the user.
3. In the Supabase SQL editor, assign the admin role:

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_UUID', 'admin');
```

### Add facilities and units

Navigate to **Admin → Facilities** to create facilities, then **Admin → Units** to add units under each facility.

### Assign users to facilities

Go to **Admin → User Management**, click a user, then use the facility assignment dialog.

---

## Role Reference

| Role | Access |
|---|---|
| `admin` | Full access — all pages, user management, admin panel |
| `editor` | All data entry pages, no admin panel |
| `viewer` | Read-only across all data views |
| `nursing` | Daily operations (Staffing + Quality sections only) |
| `service_development` | Daily operations (Service Development section only) |
| `program_administrator` | Budget, actuals, dashboard, operations |
| `adon` | Dashboard, operations summary, KPI |
| `don` | Dashboard, operations summary, KPI |
| `him` | Budget entry, actuals |
| `sdd` | Service development reporting |
| `human_resources` | HR-scoped operational data |

---

## Customization Guide

### Branding

| File | What to change |
|---|---|
| `src/components/layout/Sidebar.tsx` | App name in the logo area (`OPS DASHBOARD`) |
| `index.html` | `<title>` tag and meta description |
| `src/index.css` | CSS custom properties for colors (`--primary`, sidebar palette, chart colors) |
| `public/favicon.png` | Replace with your logo |

### Navigation labels

Edit the `navigation` array in `src/components/layout/Sidebar.tsx` to rename, reorder, or remove pages.

### Budget structure

The budget template is defined in `src/lib/budget-structure.ts`. Each section and row has a `name`, `data_type`, `entry_mode`, and optional `formula`. Modify these arrays to match your organization's chart of accounts.

After modifying `budget-structure.ts`, re-run the seed function from the Admin panel to apply changes to the database.

### Payer types / revenue rates

Payer categories are stored per-unit in the `unit_budget_config` table. Rates are configurable per unit through the Admin → Units interface. The daily operations form uses these rates to calculate projected revenue.

### Daily operations fields

The 150+ field daily operations form is in `src/pages/DailyOperations.tsx` and backed by the `daily_operations` table (see `src/integrations/supabase/types.ts`). To add or remove fields:

1. Add a new migration in `supabase/migrations/` with `ALTER TABLE daily_operations ADD COLUMN ...`
2. Regenerate types: `supabase gen types typescript --linked > src/integrations/supabase/types.ts`
3. Add the field to the form in `DailyOperations.tsx` and the data hook in `src/hooks/useDailyOperations.ts`

### Roles

Roles are defined as a PostgreSQL enum. To add a new role:

1. Create a migration: `ALTER TYPE app_role ADD VALUE 'new_role';`
2. Add it to `AuthContext.tsx` and the role-check logic
3. Add the display label in `Sidebar.tsx` → `roleLabels`

---

## Database Schema

17 tables across these domains:

```
Auth / Access
├── profiles              — Extended user profiles
├── user_roles            — Role assignments (one per user)
├── user_facility_assignments — Many-to-many: users ↔ facilities
├── user_access_settings  — Can-view-all flag per user
└── activity_logs         — Full audit trail

Org Structure
├── facilities            — Top-level organizations / hospitals
└── units                 — Sub-units / departments / programs

Budget
├── budget_years          — Fiscal years (lockable)
├── budget_sections       — Section groupings
├── budget_rows           — Rows with formula support
├── budget_templates      — Reusable row templates
├── budget_template_rows  — Template row definitions
├── budgets               — Monthly budget values
├── actual_entries        — Daily actual values
└── unit_budget_config    — Per-unit rates and cost targets

Operations
├── daily_operations      — Comprehensive daily logs (150+ columns)
├── iop_patients          — Outpatient patient enrollment
├── service_development_entries — Territory-based referral metrics
└── program_ranking_daily_actuals — Daily census snapshots for rankings
```

See `supabase/migrations/` for the full DDL and RLS policies.

---

## Deployment

### Vercel (recommended)

```bash
npm run build
vercel --prod
```

Set the three `VITE_*` environment variables in your Vercel project settings.

### Any static host

```bash
npm run build
# Upload the dist/ directory to your host
```

---

## Support & Customization

This template is sold as-is with full source code. For custom development — additional modules, integrations, or white-label builds — contact the seller.

---

## License

Single-use commercial license. You may deploy this template for one organization. Redistribution or resale of the source code is not permitted.
