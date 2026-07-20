// @vitest-environment node
//
// Cross-tenant isolation test suite -- the product's warranty that
// Organization A can never see, insert into, update, or delete
// Organization B's data.
//
// This suite is written against the TARGET behavior of the Phase 2 RLS
// rewrite (supabase/migrations/20260718140000_multitenant_phase2_rls_rewrite.sql),
// which is expected to exist by the time this suite is meant to pass in
// full. If that migration has not landed yet, every assertion that
// depends on org-scoped RLS (cross-tenant SELECT/INSERT/UPDATE/DELETE,
// the org_members / organizations / profiles org-scoping, and the
// "no USING(true) policy survives" belt-and-braces check) is EXPECTED
// to fail, because the current (Phase 1) policies are either absent
// (organizations/org_members) or still the original single-tenant
// "all authenticated users can see everything" policies. This file
// must never be edited to "make it pass" by weakening an assertion --
// it exists to prove Phase 2 did its job once it lands.
//
// Requires a real Postgres reachable at process.env.TEST_DATABASE_URL.
// Use `npm run test:isolation` (scripts/test-db.sh) to get one -- it
// boots a throwaway PG16 cluster, applies db-bootstrap.sql + every
// migration, applies Supabase-default grants, and runs this file with
// TEST_DATABASE_URL set. Plain `vitest run` / `npm run test:unit` skip
// this suite entirely so they never depend on Postgres being present.

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";

const DB_URL = process.env.TEST_DATABASE_URL;

if (!DB_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    "[isolation.test.ts] TEST_DATABASE_URL is not set -- skipping the cross-tenant isolation suite.\n" +
      "  Run `npm run test:isolation` to boot a throwaway Postgres cluster (via scripts/test-db.sh) and execute it."
  );
}

/* ========================================================================
 * Fixed, obviously-fake seed identifiers
 * ==================================================================== */

const ACME_ORG_ID = "10000000-0000-0000-0000-000000000001";
const PELICAN_ORG_ID = "10000000-0000-0000-0000-000000000002";

const ACME_ADMIN_ID = "20000000-0000-0000-0000-00000000000a";
const ACME_VIEWER_ID = "20000000-0000-0000-0000-00000000000b";
const PELICAN_ADMIN_ID = "20000000-0000-0000-0000-00000000000c";
const PELICAN_EDITOR_ID = "20000000-0000-0000-0000-00000000000d";

const ACME_FACILITY_ID = "30000000-0000-0000-0000-000000000001";
const PELICAN_FACILITY_ID = "30000000-0000-0000-0000-000000000002";

const ACME_UNIT_ID = "40000000-0000-0000-0000-000000000001";
// A second Acme unit, used only by the unit_budget_config cross-insert
// test below (unit_budget_config has UNIQUE(unit_id), so the "real" seed
// row's unit can't be reused for a second insert attempt).
const ACME_UNIT_ID_2 = "40000000-0000-0000-0000-000000000003";
const PELICAN_UNIT_ID = "40000000-0000-0000-0000-000000000002";

const ACME_BUDGET_YEAR_ID = "50000000-0000-0000-0000-000000000001";
const PELICAN_BUDGET_YEAR_ID = "50000000-0000-0000-0000-000000000002";

const ACME_SECTION_ID = "60000000-0000-0000-0000-000000000001";
const PELICAN_SECTION_ID = "60000000-0000-0000-0000-000000000002";

const ACME_ROW_ID = "70000000-0000-0000-0000-000000000001";
const PELICAN_ROW_ID = "70000000-0000-0000-0000-000000000002";

const ACME_BUDGET_ID = "80000000-0000-0000-0000-000000000001";
const PELICAN_BUDGET_ID = "80000000-0000-0000-0000-000000000002";

const ACME_ACTUAL_ENTRY_ID = "90000000-0000-0000-0000-000000000001";
const PELICAN_ACTUAL_ENTRY_ID = "90000000-0000-0000-0000-000000000002";

const ACME_DAILY_OPS_ID = "a0000000-0000-0000-0000-000000000001";
const PELICAN_DAILY_OPS_ID = "a0000000-0000-0000-0000-000000000002";

const ACME_SDE_ID = "b0000000-0000-0000-0000-000000000001";
const PELICAN_SDE_ID = "b0000000-0000-0000-0000-000000000002";

const ACME_IOP_PATIENT_ID = "c0000000-0000-0000-0000-000000000001";
const PELICAN_IOP_PATIENT_ID = "c0000000-0000-0000-0000-000000000002";

const ACME_UBC_ID = "d0000000-0000-0000-0000-000000000001";
const PELICAN_UBC_ID = "d0000000-0000-0000-0000-000000000002";

const ACME_PRDA_ID = "e0000000-0000-0000-0000-000000000001";
const PELICAN_PRDA_ID = "e0000000-0000-0000-0000-000000000002";

/** The 12 tenant-scoped tables introduced by the Phase 1 migration. */
const TENANT_TABLES = [
  "facilities",
  "budget_years",
  "budget_sections",
  "budget_rows",
  "budgets",
  "actual_entries",
  "units",
  "daily_operations",
  "service_development_entries",
  "iop_patients",
  "unit_budget_config",
  "program_ranking_daily_actuals",
] as const;

interface TenantTableSpec {
  table: (typeof TENANT_TABLES)[number];
  /**
   * A row payload that is entirely valid for the ACME org (every FK
   * points at ACME-owned parents) -- used for the cross-tenant INSERT
   * test, where a Pelican user attempts to insert it. Any rejection must
   * come from the org_id/RLS check, not from a dangling FK or a unique
   * collision, so each spec picks values that don't collide with the
   * seed row already created for that table.
   */
  acmeInsertRow: (id: string) => Record<string, unknown>;
}

const TENANT_TABLE_SPECS: TenantTableSpec[] = [
  {
    table: "facilities",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      name: "Acme Cross-Insert Test Facility",
      code: `ACME-XI-${id.slice(0, 8)}`,
    }),
  },
  {
    table: "units",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      facility_id: ACME_FACILITY_ID,
      name: `Acme Cross-Insert Test Unit ${id.slice(0, 8)}`,
    }),
  },
  {
    table: "budget_years",
    acmeInsertRow: (id) => ({ id, org_id: ACME_ORG_ID, year: 2031 }),
  },
  {
    table: "budget_sections",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      name: `Acme Cross-Insert Test Section ${id.slice(0, 8)}`,
    }),
  },
  {
    table: "budget_rows",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      section_id: ACME_SECTION_ID,
      name: `Acme Cross-Insert Test Row ${id.slice(0, 8)}`,
      row_key: `acme-cross-insert-${id}`,
    }),
  },
  {
    table: "budgets",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      facility_id: ACME_FACILITY_ID,
      unit_id: ACME_UNIT_ID,
      budget_year_id: ACME_BUDGET_YEAR_ID,
      row_id: ACME_ROW_ID,
      month: 2,
      created_by: ACME_ADMIN_ID,
    }),
  },
  {
    table: "actual_entries",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      facility_id: ACME_FACILITY_ID,
      unit_id: ACME_UNIT_ID,
      date: "2026-02-01",
      budget_year_id: ACME_BUDGET_YEAR_ID,
      row_id: ACME_ROW_ID,
      submitted_by: ACME_ADMIN_ID,
    }),
  },
  {
    table: "daily_operations",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      facility_id: ACME_FACILITY_ID,
      unit_id: ACME_UNIT_ID,
      date: "2026-02-01",
      submitted_by: ACME_ADMIN_ID,
    }),
  },
  {
    table: "service_development_entries",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      facility_id: ACME_FACILITY_ID,
      unit_id: ACME_UNIT_ID,
      date: "2026-02-01",
      territory: "Red",
      metric_name: "cross-insert-test",
      submitted_by: ACME_ADMIN_ID,
    }),
  },
  {
    table: "iop_patients",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      unit_id: ACME_UNIT_ID,
      facility_id: ACME_FACILITY_ID,
      first_name: "XXX",
      last_name: "X",
      admit_date: "2026-02-01",
      created_by: ACME_ADMIN_ID,
    }),
  },
  {
    table: "unit_budget_config",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      // Must be a *different* Acme unit than the seed row's, since
      // unit_budget_config has UNIQUE(unit_id).
      unit_id: ACME_UNIT_ID_2,
    }),
  },
  {
    table: "program_ranking_daily_actuals",
    acmeInsertRow: (id) => ({
      id,
      org_id: ACME_ORG_ID,
      facility_id: ACME_FACILITY_ID,
      unit_id: ACME_UNIT_ID,
      date: "2026-02-02",
      source: "test",
    }),
  },
];

function buildInsert(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const values = cols.map((c) => row[c]);
  return {
    sql: `INSERT INTO public.${table} (${cols.join(", ")}) VALUES (${placeholders.join(", ")})`,
    values,
  };
}

describe.skipIf(!DB_URL)(
  "cross-tenant isolation (Phase 2 RLS target behavior)",
  () => {
    const pool = new Pool({ connectionString: DB_URL });
    let superuser: PoolClient;

    /**
     * Runs `fn` inside a transaction impersonating `userId` as the
     * `authenticated` role (SET LOCAL ROLE + request.jwt.claims), on a
     * brand-new connection, and ALWAYS rolls back afterwards -- whether
     * `fn` resolved or rejected -- so no impersonated context or test
     * side effect can ever leak into another test.
     */
    async function asUser<T>(
      userId: string,
      fn: (client: PoolClient) => Promise<T>
    ): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE authenticated");
        await client.query(
          `SELECT set_config('request.jwt.claims', $1, true)`,
          [JSON.stringify({ sub: userId, role: "authenticated" })]
        );
        return await fn(client);
      } finally {
        await client.query("ROLLBACK").catch(() => {});
        client.release();
      }
    }

    async function seed(db: PoolClient) {
      // --- organizations -------------------------------------------------
      await db.query(
        `INSERT INTO public.organizations (id, name, slug) VALUES
           ($1, 'Acme Behavioral', 'acme-behavioral'),
           ($2, 'Pelican Recovery', 'pelican-recovery')`,
        [ACME_ORG_ID, PELICAN_ORG_ID]
      );

      // --- auth.users (fake, obviously-fake addresses) --------------------
      // The on_auth_user_created trigger (see
      // supabase/migrations/20251222155100_...sql) fires on each of these
      // inserts and auto-creates a matching public.profiles row (and a
      // public.user_roles row), which is what the "profiles" tests below
      // exercise -- no separate profiles insert is needed.
      const users: Array<[string, string, string]> = [
        [ACME_ADMIN_ID, "acme-admin@example-acme-behavioral.test", "Acme Admin (test fixture)"],
        [ACME_VIEWER_ID, "acme-viewer@example-acme-behavioral.test", "Acme Viewer (test fixture)"],
        [PELICAN_ADMIN_ID, "pelican-admin@example-pelican-recovery.test", "Pelican Admin (test fixture)"],
        [PELICAN_EDITOR_ID, "pelican-editor@example-pelican-recovery.test", "Pelican Editor (test fixture)"],
      ];
      for (const [id, email, fullName] of users) {
        await db.query(
          `INSERT INTO auth.users (id, email, raw_user_meta_data)
           VALUES ($1, $2, jsonb_build_object('full_name', $3::text))`,
          [id, email, fullName]
        );
      }

      // --- org_members ------------------------------------------------
      await db.query(
        `INSERT INTO public.org_members (org_id, user_id, role) VALUES
           ($1, $2, 'admin'),
           ($1, $3, 'viewer'),
           ($4, $5, 'admin'),
           ($4, $6, 'editor')`,
        [
          ACME_ORG_ID,
          ACME_ADMIN_ID,
          ACME_VIEWER_ID,
          PELICAN_ORG_ID,
          PELICAN_ADMIN_ID,
          PELICAN_EDITOR_ID,
        ]
      );

      // --- facilities ---------------------------------------------------
      await db.query(
        `INSERT INTO public.facilities (id, org_id, name, code) VALUES
           ($1, $2, 'Acme Main Facility', 'ACME-MAIN'),
           ($3, $4, 'Pelican Main Facility', 'PELICAN-MAIN')`,
        [ACME_FACILITY_ID, ACME_ORG_ID, PELICAN_FACILITY_ID, PELICAN_ORG_ID]
      );

      // --- units ----------------------------------------------------------
      await db.query(
        `INSERT INTO public.units (id, org_id, facility_id, name) VALUES
           ($1, $2, $3, 'Acme Primary Unit'),
           ($4, $2, $3, 'Acme Secondary Unit'),
           ($5, $6, $7, 'Pelican Primary Unit')`,
        [
          ACME_UNIT_ID,
          ACME_ORG_ID,
          ACME_FACILITY_ID,
          ACME_UNIT_ID_2,
          PELICAN_UNIT_ID,
          PELICAN_ORG_ID,
          PELICAN_FACILITY_ID,
        ]
      );

      // --- budget_years (BOTH orgs use 2026 on purpose -- proves the
      // composite (org_id, year) unique, not a bare (year) unique) --------
      await db.query(
        `INSERT INTO public.budget_years (id, org_id, year) VALUES
           ($1, $2, 2026),
           ($3, $4, 2026)`,
        [ACME_BUDGET_YEAR_ID, ACME_ORG_ID, PELICAN_BUDGET_YEAR_ID, PELICAN_ORG_ID]
      );

      // --- budget_sections --------------------------------------------
      await db.query(
        `INSERT INTO public.budget_sections (id, org_id, name) VALUES
           ($1, $2, 'Acme Test Section'),
           ($3, $4, 'Pelican Test Section')`,
        [ACME_SECTION_ID, ACME_ORG_ID, PELICAN_SECTION_ID, PELICAN_ORG_ID]
      );

      // --- budget_rows ------------------------------------------------
      await db.query(
        `INSERT INTO public.budget_rows (id, org_id, section_id, name, row_key) VALUES
           ($1, $2, $3, 'Acme Test Row', 'acme-test-row'),
           ($4, $5, $6, 'Pelican Test Row', 'pelican-test-row')`,
        [
          ACME_ROW_ID,
          ACME_ORG_ID,
          ACME_SECTION_ID,
          PELICAN_ROW_ID,
          PELICAN_ORG_ID,
          PELICAN_SECTION_ID,
        ]
      );

      // --- budgets ----------------------------------------------------
      await db.query(
        `INSERT INTO public.budgets
           (id, org_id, facility_id, unit_id, budget_year_id, row_id, month, created_by) VALUES
           ($1, $2, $3, $4, $5, $6, 1, $7),
           ($8, $9, $10, $11, $12, $13, 1, $14)`,
        [
          ACME_BUDGET_ID,
          ACME_ORG_ID,
          ACME_FACILITY_ID,
          ACME_UNIT_ID,
          ACME_BUDGET_YEAR_ID,
          ACME_ROW_ID,
          ACME_ADMIN_ID,
          PELICAN_BUDGET_ID,
          PELICAN_ORG_ID,
          PELICAN_FACILITY_ID,
          PELICAN_UNIT_ID,
          PELICAN_BUDGET_YEAR_ID,
          PELICAN_ROW_ID,
          PELICAN_ADMIN_ID,
        ]
      );

      // --- actual_entries -----------------------------------------------
      await db.query(
        `INSERT INTO public.actual_entries
           (id, org_id, facility_id, unit_id, date, budget_year_id, row_id, submitted_by) VALUES
           ($1, $2, $3, $4, '2026-01-15', $5, $6, $7),
           ($8, $9, $10, $11, '2026-01-15', $12, $13, $14)`,
        [
          ACME_ACTUAL_ENTRY_ID,
          ACME_ORG_ID,
          ACME_FACILITY_ID,
          ACME_UNIT_ID,
          ACME_BUDGET_YEAR_ID,
          ACME_ROW_ID,
          ACME_ADMIN_ID,
          PELICAN_ACTUAL_ENTRY_ID,
          PELICAN_ORG_ID,
          PELICAN_FACILITY_ID,
          PELICAN_UNIT_ID,
          PELICAN_BUDGET_YEAR_ID,
          PELICAN_ROW_ID,
          PELICAN_ADMIN_ID,
        ]
      );

      // --- daily_operations (every other NOT NULL column has a default) --
      //
      // This insert exercises the real sync_program_ranking_daily_actuals_
      // from_daily_operations() AFTER INSERT trigger (20260423161206_...sql
      // / 20260423164728_...sql, fixed to propagate org_id by
      // 20260718150000_fix_sync_trigger_org_id.sql), which upserts a
      // matching row into public.program_ranking_daily_actuals keyed on
      // (unit_id, date). That's why the explicit
      // program_ranking_daily_actuals seed below uses a different date --
      // it would otherwise collide with the row this trigger creates for
      // (ACME_UNIT_ID, '2026-01-15') / (PELICAN_UNIT_ID, '2026-01-15').
      await db.query(
        `INSERT INTO public.daily_operations
           (id, org_id, facility_id, unit_id, date, submitted_by) VALUES
           ($1, $2, $3, $4, '2026-01-15', $5),
           ($6, $7, $8, $9, '2026-01-15', $10)`,
        [
          ACME_DAILY_OPS_ID,
          ACME_ORG_ID,
          ACME_FACILITY_ID,
          ACME_UNIT_ID,
          ACME_ADMIN_ID,
          PELICAN_DAILY_OPS_ID,
          PELICAN_ORG_ID,
          PELICAN_FACILITY_ID,
          PELICAN_UNIT_ID,
          PELICAN_ADMIN_ID,
        ]
      );

      // --- service_development_entries (territory 'Red') ------------------
      await db.query(
        `INSERT INTO public.service_development_entries
           (id, org_id, facility_id, unit_id, date, territory, metric_name, submitted_by) VALUES
           ($1, $2, $3, $4, '2026-01-15', 'Red', 'admits', $5),
           ($6, $7, $8, $9, '2026-01-15', 'Red', 'admits', $10)`,
        [
          ACME_SDE_ID,
          ACME_ORG_ID,
          ACME_FACILITY_ID,
          ACME_UNIT_ID,
          ACME_ADMIN_ID,
          PELICAN_SDE_ID,
          PELICAN_ORG_ID,
          PELICAN_FACILITY_ID,
          PELICAN_UNIT_ID,
          PELICAN_ADMIN_ID,
        ]
      );

      // --- iop_patients (fake initials only, never real names) ------------
      await db.query(
        `INSERT INTO public.iop_patients
           (id, org_id, unit_id, facility_id, first_name, last_name, admit_date, created_by) VALUES
           ($1, $2, $3, $4, 'AAA', 'B', '2026-01-10', $5),
           ($6, $7, $8, $9, 'PPP', 'R', '2026-01-10', $10)`,
        [
          ACME_IOP_PATIENT_ID,
          ACME_ORG_ID,
          ACME_UNIT_ID,
          ACME_FACILITY_ID,
          ACME_ADMIN_ID,
          PELICAN_IOP_PATIENT_ID,
          PELICAN_ORG_ID,
          PELICAN_UNIT_ID,
          PELICAN_FACILITY_ID,
          PELICAN_ADMIN_ID,
        ]
      );

      // --- unit_budget_config (every rate column has a default) -----------
      await db.query(
        `INSERT INTO public.unit_budget_config (id, org_id, unit_id) VALUES
           ($1, $2, $3),
           ($4, $5, $6)`,
        [
          ACME_UBC_ID,
          ACME_ORG_ID,
          ACME_UNIT_ID,
          PELICAN_UBC_ID,
          PELICAN_ORG_ID,
          PELICAN_UNIT_ID,
        ]
      );

      // --- program_ranking_daily_actuals (source 'test') -------------------
      //
      // Uses '2026-01-16', distinct from the daily_operations seed date
      // ('2026-01-15' above), because the sync_program_ranking_daily_
      // actuals_from_daily_operations() trigger fired by that
      // daily_operations insert already upserted a (unit_id, date) row for
      // '2026-01-15' -- a plain INSERT here for the same key would collide
      // with it.
      await db.query(
        `INSERT INTO public.program_ranking_daily_actuals
           (id, org_id, facility_id, unit_id, date, source) VALUES
           ($1, $2, $3, $4, '2026-01-16', 'test'),
           ($5, $6, $7, $8, '2026-01-16', 'test')`,
        [
          ACME_PRDA_ID,
          ACME_ORG_ID,
          ACME_FACILITY_ID,
          ACME_UNIT_ID,
          PELICAN_PRDA_ID,
          PELICAN_ORG_ID,
          PELICAN_FACILITY_ID,
          PELICAN_UNIT_ID,
        ]
      );
    }

    beforeAll(async () => {
      superuser = await pool.connect();
      await seed(superuser);
    }, 60_000);

    afterAll(async () => {
      superuser?.release();
      await pool.end();
    });

    /* ====================================================================
     * Per-table cross-tenant SELECT / INSERT / UPDATE / DELETE
     * ================================================================== */

    describe.each(TENANT_TABLE_SPECS)("$table", ({ table, acmeInsertRow }) => {
      it("acme viewer sees 0 pelican rows, and every visible row belongs to acme", async () => {
        await asUser(ACME_VIEWER_ID, async (c) => {
          const pelicanRows = await c.query(
            `SELECT 1 FROM public.${table} WHERE org_id = $1`,
            [PELICAN_ORG_ID]
          );
          expect(pelicanRows.rowCount).toBe(0);

          const allRows = await c.query(`SELECT org_id FROM public.${table}`);
          expect(allRows.rowCount).toBeGreaterThan(0);
          for (const row of allRows.rows) {
            expect(row.org_id).toBe(ACME_ORG_ID);
          }
        });
      });

      it("pelican editor cannot INSERT a row with org_id = acme org", async () => {
        const { sql, values } = buildInsert(table, acmeInsertRow(randomUUID()));
        await expect(
          asUser(PELICAN_EDITOR_ID, (c) => c.query(sql, values))
        ).rejects.toThrow(/row-level security|permission denied/i);
      });

      it("acme admin's UPDATE targeting pelican rows affects 0 rows", async () => {
        await asUser(ACME_ADMIN_ID, async (c) => {
          const result = await c.query(
            `UPDATE public.${table} SET updated_at = now() WHERE org_id = $1`,
            [PELICAN_ORG_ID]
          );
          expect(result.rowCount).toBe(0);
        });
      });

      it("acme admin's DELETE targeting pelican rows affects 0 rows", async () => {
        await asUser(ACME_ADMIN_ID, async (c) => {
          const result = await c.query(
            `DELETE FROM public.${table} WHERE org_id = $1`,
            [PELICAN_ORG_ID]
          );
          expect(result.rowCount).toBe(0);
        });
      });
    });

    /* ====================================================================
     * Same-org role rules
     * ================================================================== */

    describe("same-org role rules", () => {
      it("acme viewer INSERT into budgets is rejected", async () => {
        const id = randomUUID();
        await expect(
          asUser(ACME_VIEWER_ID, (c) =>
            c.query(
              `INSERT INTO public.budgets
                 (id, org_id, facility_id, unit_id, budget_year_id, row_id, month, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, 3, $7)`,
              [
                id,
                ACME_ORG_ID,
                ACME_FACILITY_ID,
                ACME_UNIT_ID,
                ACME_BUDGET_YEAR_ID,
                ACME_ROW_ID,
                ACME_VIEWER_ID,
              ]
            )
          )
        ).rejects.toThrow(/row-level security|permission denied/i);
      });

      it("acme viewer UPDATE facilities is rejected (0 rows affected)", async () => {
        await asUser(ACME_VIEWER_ID, async (c) => {
          const result = await c.query(
            `UPDATE public.facilities SET name = name WHERE id = $1`,
            [ACME_FACILITY_ID]
          );
          expect(result.rowCount).toBe(0);
        });
      });

      it("pelican editor CAN insert budgets in pelican org", async () => {
        const id = randomUUID();
        await asUser(PELICAN_EDITOR_ID, async (c) => {
          const result = await c.query(
            `INSERT INTO public.budgets
               (id, org_id, facility_id, unit_id, budget_year_id, row_id, month, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, 4, $7)`,
            [
              id,
              PELICAN_ORG_ID,
              PELICAN_FACILITY_ID,
              PELICAN_UNIT_ID,
              PELICAN_BUDGET_YEAR_ID,
              PELICAN_ROW_ID,
              PELICAN_EDITOR_ID,
            ]
          );
          expect(result.rowCount).toBe(1);
        });
      });

      it("pelican editor DELETE from budgets is blocked -- 0 rows or an error (delete is admin-only)", async () => {
        try {
          const result = await asUser(PELICAN_EDITOR_ID, (c) =>
            c.query(`DELETE FROM public.budgets WHERE id = $1`, [PELICAN_BUDGET_ID])
          );
          expect(result.rowCount).toBe(0);
        } catch (err) {
          expect(err).toBeInstanceOf(Error);
        }
      });

      it("acme admin CAN insert and update own-org facilities", async () => {
        const id = randomUUID();
        await asUser(ACME_ADMIN_ID, async (c) => {
          const inserted = await c.query(
            `INSERT INTO public.facilities (id, org_id, name, code) VALUES ($1, $2, 'Acme Admin Insert Test', $3)`,
            [id, ACME_ORG_ID, `ACME-ADMIN-${id.slice(0, 8)}`]
          );
          expect(inserted.rowCount).toBe(1);

          const updated = await c.query(
            `UPDATE public.facilities SET name = name WHERE id = $1`,
            [ACME_FACILITY_ID]
          );
          expect(updated.rowCount).toBe(1);
        });
      });
    });

    /* ====================================================================
     * org_members
     * ================================================================== */

    describe("org_members", () => {
      it("acme viewer cannot see pelican org's members", async () => {
        await asUser(ACME_VIEWER_ID, async (c) => {
          const result = await c.query(
            `SELECT 1 FROM public.org_members WHERE org_id = $1`,
            [PELICAN_ORG_ID]
          );
          expect(result.rowCount).toBe(0);
        });
      });

      it("acme admin cannot insert a member into pelican org", async () => {
        await expect(
          asUser(ACME_ADMIN_ID, (c) =>
            c.query(
              `INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'viewer')`,
              [PELICAN_ORG_ID, randomUUID()]
            )
          )
        ).rejects.toThrow(/row-level security|permission denied/i);
      });

      it("deleting the last admin of an org raises (trigger)", async () => {
        const scratchOrgId = randomUUID();
        const scratchAdminId = randomUUID();
        const scratchOrgMemberId = randomUUID();

        await superuser.query(
          `INSERT INTO public.organizations (id, name, slug) VALUES ($1, 'Scratch Org', $2)`,
          [scratchOrgId, `scratch-org-${scratchOrgId.slice(0, 8)}`]
        );
        await superuser.query(
          `INSERT INTO auth.users (id, email) VALUES ($1, $2)`,
          [scratchAdminId, `scratch-admin-${scratchAdminId.slice(0, 8)}@example-scratch.test`]
        );
        await superuser.query(
          `INSERT INTO public.org_members (id, org_id, user_id, role) VALUES ($1, $2, $3, 'admin')`,
          [scratchOrgMemberId, scratchOrgId, scratchAdminId]
        );

        // The trigger is a data-integrity guarantee, not a permission
        // check -- it must fire regardless of who (or what role) issues
        // the DELETE, including the superuser seeding connection.
        await expect(
          superuser.query(`DELETE FROM public.org_members WHERE id = $1`, [
            scratchOrgMemberId,
          ])
        ).rejects.toThrow();

        // Clean up regardless of outcome so this scratch fixture never
        // leaks into other tests (org_members delete may or may not have
        // been rejected by the assertion above).
        await superuser
          .query(`DELETE FROM public.org_members WHERE org_id = $1`, [scratchOrgId])
          .catch(() => {});
        await superuser
          .query(`DELETE FROM public.organizations WHERE id = $1`, [scratchOrgId])
          .catch(() => {});
        await superuser
          .query(`DELETE FROM auth.users WHERE id = $1`, [scratchAdminId])
          .catch(() => {});
      });
    });

    /* ====================================================================
     * organizations
     * ================================================================== */

    describe("organizations", () => {
      it("acme viewer sees only the acme org", async () => {
        await asUser(ACME_VIEWER_ID, async (c) => {
          const result = await c.query(`SELECT id FROM public.organizations`);
          expect(result.rowCount).toBe(1);
          expect(result.rows[0].id).toBe(ACME_ORG_ID);
        });
      });

      it("pelican admin can update the pelican org's name", async () => {
        await asUser(PELICAN_ADMIN_ID, async (c) => {
          const result = await c.query(
            `UPDATE public.organizations SET name = 'Pelican Recovery (updated)' WHERE id = $1`,
            [PELICAN_ORG_ID]
          );
          expect(result.rowCount).toBe(1);
        });
      });

      it("pelican admin cannot update the acme org's name (0 rows)", async () => {
        await asUser(PELICAN_ADMIN_ID, async (c) => {
          const result = await c.query(
            `UPDATE public.organizations SET name = 'Hijacked' WHERE id = $1`,
            [ACME_ORG_ID]
          );
          expect(result.rowCount).toBe(0);
        });
      });
    });

    /* ====================================================================
     * profiles
     * ================================================================== */

    describe("profiles", () => {
      it("acme viewer sees own + same-org profiles but not pelican users' profiles", async () => {
        await asUser(ACME_VIEWER_ID, async (c) => {
          const result = await c.query(`SELECT id FROM public.profiles`);
          const visibleIds = new Set(result.rows.map((r) => r.id));

          expect(visibleIds.has(ACME_VIEWER_ID)).toBe(true);
          expect(visibleIds.has(ACME_ADMIN_ID)).toBe(true);
          expect(visibleIds.has(PELICAN_ADMIN_ID)).toBe(false);
          expect(visibleIds.has(PELICAN_EDITOR_ID)).toBe(false);
        });
      });
    });

    /* ====================================================================
     * Composite uniques
     * ================================================================== */

    describe("composite uniques", () => {
      it("both orgs already coexist with budget_year 2026 (cross-org, proven by seed succeeding)", async () => {
        const result = await superuser.query(
          `SELECT org_id FROM public.budget_years WHERE year = 2026 ORDER BY org_id`
        );
        expect(result.rowCount).toBe(2);
        const orgIds = result.rows.map((r) => r.org_id).sort();
        expect(orgIds).toEqual([ACME_ORG_ID, PELICAN_ORG_ID].sort());
      });

      it("a same-org duplicate (acme, 2026) is rejected", async () => {
        await expect(
          superuser.query(
            `INSERT INTO public.budget_years (org_id, year) VALUES ($1, 2026)`,
            [ACME_ORG_ID]
          )
        ).rejects.toThrow(/unique|duplicate key/i);
      });
    });

    /* ====================================================================
     * Belt-and-braces: no permissive USING(true)/WITH CHECK(true) policy
     * survives on any of the 12 tenant tables.
     * ================================================================== */

    describe("no permissive USING(true)/WITH CHECK(true) policies remain", () => {
      it("pg_policies has zero qual='true' or with_check='true' rows for the 12 tenant tables", async () => {
        const result = await superuser.query(
          `SELECT tablename, policyname, qual, with_check
             FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = ANY($1::text[])
              AND (qual = 'true' OR with_check = 'true')`,
          [TENANT_TABLES as unknown as string[]]
        );
        expect(
          result.rows,
          `Found permissive USING(true)/WITH CHECK(true) polic${result.rows.length === 1 ? "y" : "ies"}: ${JSON.stringify(result.rows)}`
        ).toEqual([]);
      });
    });
  }
);
