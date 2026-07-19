-- =============================================================================
-- Neutralize default org name/slug
-- =============================================================================
-- Phase 1 (20260718120000_multitenant_phase1_tenant_model.sql) backfilled the
-- single tenant org with the real customer name 'Freedom Behavioral Health'
-- (slug 'freedom-behavioral-health'). That bakes a real customer's name into
-- committed migration history, which we don't want. This migration renames
-- that same fixed-id org to a neutral placeholder instead. Prod operators can
-- rename it to the actual tenant name/slug per environment after the fact.
--
-- Safe on a fresh (dev) database, where no org with this id exists yet: the
-- UPDATE simply matches 0 rows. Safe on prod, where the Phase 1 migration
-- already inserted this org: the UPDATE matches exactly the 1 row. The new
-- slug 'default-org' cannot collide with the existing unique slug constraint
-- because, in single-tenant state, this is the only organization row.
-- =============================================================================

UPDATE public.organizations
SET name = 'Default Organization', slug = 'default-org'
WHERE id = '00000000-0000-0000-0000-000000000001';
