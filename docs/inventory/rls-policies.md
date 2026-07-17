# RLS Policy Inventory (Phase 0 baseline)

> Generated 2026-07-17 as the Phase 0 baseline for the multi-tenant migration.
> Reflects the final effective state after all 49 migrations up to `20260511181453`.

## SECURITY DEFINER Functions

| Function Name | Signature | Migration | Description |
|---|---|---|---|
| `has_role` | `has_role(_user_id UUID, _role app_role) RETURNS BOOLEAN` | 20251222155100 | Checks if a user has a specific role by querying user_roles table |
| `get_user_role` | `get_user_role(_user_id UUID) RETURNS app_role` | 20251222155100 | Returns user's highest-priority role (admin > editor > viewer) |
| `handle_new_user` | `handle_new_user() RETURNS TRIGGER` | 20251222155100 | Trigger: creates profile and assigns default 'viewer' role on auth signup |
| `user_can_view_facility` | `user_can_view_facility(_user_id uuid, _facility_id uuid) RETURNS boolean` | 20260127161057 | User can view a facility based on admin status, global access settings, or facility assignments |
| `sync_program_ranking_daily_actuals_from_daily_operations` | `... RETURNS trigger` | 20260423164728 | Trigger: syncs daily_operations census data to program_ranking_daily_actuals |
| `update_updated_at_column` | `update_updated_at_column() RETURNS TRIGGER` | 20251222155100 | Generic updated_at trigger (not SECURITY DEFINER-relevant to roles) |

## Tables with RLS Enabled and Current Effective Policies

EDIT_ROLES below = `admin OR editor OR nursing OR service_development OR program_administrator OR adon OR don OR him OR sdd` (each via `has_role(auth.uid(), '<role>'::app_role)`).

### 1. profiles (RLS ENABLED)
| Policy | Cmd | Roles | USING | WITH CHECK | Migration |
|---|---|---|---|---|---|
| Users can view all profiles | SELECT | authenticated | `true` | — | 20251222155100 |
| Users can update own profile | UPDATE | authenticated | `auth.uid() = id` | — | 20251222155100 |

### 2. user_roles (RLS ENABLED)
| Policy | Cmd | Roles | USING | WITH CHECK | Migration |
|---|---|---|---|---|---|
| Users can view own roles | SELECT | authenticated | `user_id = auth.uid()` | — | 20251222155100 |
| Admins can view all roles | SELECT | authenticated | `public.has_role(auth.uid(), 'admin')` | — | 20251222155100 |
| Admins can insert roles | INSERT | authenticated | — | `public.has_role(auth.uid(), 'admin')` | 20251222155100 |
| Admins can update roles | UPDATE | authenticated | `public.has_role(auth.uid(), 'admin')` | — | 20251222155100 |
| Admins can delete roles | DELETE | authenticated | `public.has_role(auth.uid(), 'admin')` | — | 20251222155100 |

### 3. facilities (RLS ENABLED)
| Policy | Cmd | Roles | USING | WITH CHECK | Migration |
|---|---|---|---|---|---|
| All users can view facilities | SELECT | authenticated | `true` | — | 20251222155100 |
| Admins can insert facilities | INSERT | authenticated | — | `public.has_role(auth.uid(), 'admin')` | 20251222155100 |
| Admins can update facilities | UPDATE | authenticated | `public.has_role(auth.uid(), 'admin')` | — | 20251222155100 |
| Admins can delete facilities | DELETE | authenticated | `public.has_role(auth.uid(), 'admin')` | — | 20251222155100 |

### 4. budget_years (RLS ENABLED)
| Policy | Cmd | Roles | USING | WITH CHECK | Migration |
|---|---|---|---|---|---|
| All users can view budget_years | SELECT | authenticated | `true` | — | 20251222155100 |
| Admins can insert budget_years | INSERT | authenticated | — | `public.has_role(auth.uid(), 'admin')` | 20251222155100 |
| Admins can update budget_years | UPDATE | authenticated | `public.has_role(auth.uid(), 'admin')` | — | 20251222155100 |
| Admins can delete budget_years | DELETE | authenticated | `public.has_role(auth.uid(), 'admin')` | — | 20251222155100 |

### 5. budget_sections (RLS ENABLED)
Same shape as budget_years: SELECT `true`; INSERT/UPDATE/DELETE admin-only. All from 20251222155100.
| Policy | Cmd | USING / WITH CHECK |
|---|---|---|
| All users can view budget_sections | SELECT | USING `true` |
| Admins can insert budget_sections | INSERT | CHECK `public.has_role(auth.uid(), 'admin')` |
| Admins can update budget_sections | UPDATE | USING `public.has_role(auth.uid(), 'admin')` |
| Admins can delete budget_sections | DELETE | USING `public.has_role(auth.uid(), 'admin')` |

### 6. budget_rows (RLS ENABLED)
Same shape as budget_sections; all from 20251222155100.
| Policy | Cmd | USING / WITH CHECK |
|---|---|---|
| All users can view budget_rows | SELECT | USING `true` |
| Admins can insert budget_rows | INSERT | CHECK `public.has_role(auth.uid(), 'admin')` |
| Admins can update budget_rows | UPDATE | USING `public.has_role(auth.uid(), 'admin')` |
| Admins can delete budget_rows | DELETE | USING `public.has_role(auth.uid(), 'admin')` |

### 7. budgets (RLS ENABLED)
| Policy | Cmd | USING / WITH CHECK | Migration |
|---|---|---|---|
| All users can view budgets | SELECT | USING `true` | 20251222155100 |
| Editors can insert budgets | INSERT | CHECK `public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')` | 20251222155100 |
| Editors can update budgets | UPDATE | USING `public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')` | 20251222155100 |
| Admins can delete budgets | DELETE | USING `public.has_role(auth.uid(),'admin')` | 20251222155100 |

### 8. actual_entries (RLS ENABLED; write policies updated by 20260106171630)
| Policy | Cmd | USING / WITH CHECK | Migration |
|---|---|---|---|
| All users can view actual_entries | SELECT | USING `true` | 20251222155100 |
| Edit roles can insert actual_entries | INSERT | CHECK EDIT_ROLES | 20260106171630 |
| Edit roles can update actual_entries | UPDATE | USING EDIT_ROLES | 20260106171630 |
| Admins can delete actual_entries | DELETE | USING `public.has_role(auth.uid(),'admin')` | 20251222155100 |

### 9. daily_operations (RLS ENABLED; write policies updated by 20260106171630)
| Policy | Cmd | USING / WITH CHECK | Migration |
|---|---|---|---|
| All users can view daily_operations | SELECT | USING `true` | 20251229202702 |
| Edit roles can insert daily_operations | INSERT | CHECK EDIT_ROLES | 20260106171630 |
| Edit roles can update daily_operations | UPDATE | USING EDIT_ROLES | 20260106171630 |
| Admins can delete daily_operations | DELETE | USING `has_role(auth.uid(),'admin'::app_role)` | 20251229202702 |

### 10. service_development_entries (RLS ENABLED; DELETE policy updated by 20260330154630)
| Policy | Cmd | USING / WITH CHECK | Migration |
|---|---|---|---|
| All users can view service_development_entries | SELECT | USING `true` | 20251230154914 |
| Edit roles can insert service_development_entries | INSERT | CHECK EDIT_ROLES | 20260106171630 |
| Edit roles can update service_development_entries | UPDATE | USING `(submitted_by = auth.uid()) OR EDIT_ROLES` | 20260106171630 |
| Edit roles can delete service_development_entries | DELETE | USING EDIT_ROLES | 20260330154630 |

### 11. units (RLS ENABLED; all from 20251230142218)
| Policy | Cmd | USING / WITH CHECK |
|---|---|---|
| All users can view units | SELECT | USING `true` |
| Admins can insert units | INSERT | CHECK `has_role(auth.uid(),'admin'::app_role)` |
| Admins can update units | UPDATE | USING `has_role(auth.uid(),'admin'::app_role)` |
| Admins can delete units | DELETE | USING `has_role(auth.uid(),'admin'::app_role)` |

### 12. unit_budget_config (RLS ENABLED; all from 20251230224808)
| Policy | Cmd | USING / WITH CHECK |
|---|---|---|
| All users can view unit_budget_config | SELECT | USING `true` |
| Admins can insert unit_budget_config | INSERT | CHECK `has_role(auth.uid(),'admin'::app_role)` |
| Admins can update unit_budget_config | UPDATE | USING `has_role(auth.uid(),'admin'::app_role)` |
| Admins can delete unit_budget_config | DELETE | USING `has_role(auth.uid(),'admin'::app_role)` |

### 13. iop_patients (RLS ENABLED; write policies updated by 20260108212442)
| Policy | Cmd | USING / WITH CHECK | Migration |
|---|---|---|---|
| All users can view iop_patients | SELECT | USING `true` | 20251231034759 |
| Edit roles can insert iop_patients | INSERT | CHECK EDIT_ROLES | 20260108212442 |
| Edit roles can update iop_patients | UPDATE | USING EDIT_ROLES | 20260108212442 |
| Edit roles can delete iop_patients | DELETE | USING EDIT_ROLES | 20260108212442 |

DATA NOTE: iop_patients stores PER-PATIENT rows (first_name VARCHAR(3), last_name VARCHAR(1), admit_date, discharge_date, groups_attended) — flagged as a data-boundary concern; see checkpoint report.

### 14. user_facility_assignments (RLS ENABLED; all from 20260127161057)
| Policy | Cmd | USING / WITH CHECK |
|---|---|---|
| Admins can view all facility assignments | SELECT | USING `has_role(auth.uid(),'admin')` |
| Users can view own facility assignments | SELECT | USING `user_id = auth.uid()` |
| Admins can insert facility assignments | INSERT | CHECK `has_role(auth.uid(),'admin')` |
| Admins can update facility assignments | UPDATE | USING `has_role(auth.uid(),'admin')` |
| Admins can delete facility assignments | DELETE | USING `has_role(auth.uid(),'admin')` |

### 15. user_access_settings (RLS ENABLED; all from 20260127161057)
| Policy | Cmd | USING / WITH CHECK |
|---|---|---|
| Admins can view all access settings | SELECT | USING `has_role(auth.uid(),'admin')` |
| Users can view own access settings | SELECT | USING `user_id = auth.uid()` |
| Admins can insert access settings | INSERT | CHECK `has_role(auth.uid(),'admin')` |
| Admins can update access settings | UPDATE | USING `has_role(auth.uid(),'admin')` |
| Admins can delete access settings | DELETE | USING `has_role(auth.uid(),'admin')` |

### 16. activity_logs (RLS ENABLED; all from 20260114152502)
| Policy | Cmd | USING / WITH CHECK |
|---|---|---|
| Admins can view all activity logs | SELECT | USING `public.has_role(auth.uid(),'admin')` |
| Users can insert their own activity logs | INSERT | CHECK `auth.uid() = user_id` |

### 17. program_ranking_daily_actuals (RLS ENABLED; all from 20260423155042)
| Policy | Cmd | USING / WITH CHECK |
|---|---|---|
| Users can view accessible ranking daily actuals | SELECT | USING `public.user_can_view_facility(auth.uid(), facility_id)` |
| Edit roles can insert accessible ranking daily actuals | INSERT | CHECK `public.user_can_view_facility(auth.uid(), facility_id) AND (EDIT_ROLES)` |
| Edit roles can update accessible ranking daily actuals | UPDATE | USING+CHECK `public.user_can_view_facility(auth.uid(), facility_id) AND (EDIT_ROLES)` |
| Admins can delete ranking daily actuals | DELETE | USING `public.has_role(auth.uid(),'admin')` |

## Summary
- 17 tables with RLS enabled; ~70 effective policies.
- Tables with blanket `USING (true)` SELECT (all authenticated users see everything): profiles, facilities, budget_years, budget_sections, budget_rows, budgets, actual_entries, daily_operations, service_development_entries, units, unit_budget_config, iop_patients. THIS is the critical multi-tenant gap.
- Exceptions (already scoped): user_roles, user_facility_assignments, user_access_settings (own-row or admin), activity_logs (admin-view), program_ranking_daily_actuals (facility-scoped via user_can_view_facility).
- app_role enum has grown to at least: admin, editor, viewer, nursing, service_development, program_administrator, adon, don, him, sdd.
- Facility-level access control (user_can_view_facility) exists but is enforced ONLY on program_ranking_daily_actuals.
