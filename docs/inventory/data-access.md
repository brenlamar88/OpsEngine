# Data Access Inventory (Phase 0 baseline)

> Generated 2026-07-17 as the Phase 0 baseline for the multi-tenant migration.
> Reflects the final effective state after all 49 migrations up to `20260511181453`.

## Inventory 1: Supabase Query Call Sites (`.from()` in src/)

| File:Line | Table/RPC | Operation | Context |
|-----------|-----------|-----------|---------|
| src/contexts/AuthContext.tsx:39 | user_roles | select | fetchUserRole() in AuthProvider |
| src/pages/KPISummary.tsx:26 | facilities | select | useEffect in KPISummary page |
| src/pages/KPISummary.tsx:34 | units | select | useEffect in KPISummary page |
| src/pages/Reports.tsx:46 | service_development_entries | select | useQuery in Reports page |
| src/pages/Reports.tsx:211 | facilities | select | handleDownloadServiceDevPDF() in Reports |
| src/pages/Reports.tsx:212 | units | select | handleDownloadServiceDevPDF() in Reports |
| src/pages/Reports.tsx:213 | service_development_entries | select | handleDownloadServiceDevPDF() in Reports |
| src/pages/Reports.tsx:217 | daily_operations | select | handleDownloadServiceDevPDF() in Reports |
| src/pages/Facilities.tsx:12 | facilities | select | page component |
| src/pages/BudgetEntry.tsx:97 | facilities | select | useEffect in BudgetEntry page |
| src/pages/BudgetEntry.tsx:113 | units | select | useEffect in BudgetEntry page |
| src/pages/DailyOperations.tsx:154 | facilities | select | useQuery in DailyOperations page |
| src/pages/DailyOperations.tsx:173 | units | select | useQuery in DailyOperations page |
| src/pages/Admin.tsx:41 | facilities | select | useQuery in Admin page |
| src/pages/Admin.tsx:53 | facilities | update | saveFacilityMutation in Admin page |
| src/pages/Admin.tsx:59 | facilities | insert | saveFacilityMutation in Admin page |
| src/pages/Admin.tsx:80 | facilities | update | toggleFacilityMutation in Admin page |
| src/pages/DailyActuals.tsx:26 | facilities | select | useQuery in DailyActuals page |
| src/pages/DailyActuals.tsx:39 | units | select | useQuery in DailyActuals page |
| src/pages/OperationsSummary.tsx:41 | facilities | select | useQuery in OperationsSummary page |
| src/pages/OperationsSummary.tsx:61 | units | select | useQuery in OperationsSummary page |
| src/pages/OperationsSummary.tsx:78 | unit_budget_config | select | useQuery in OperationsSummary page |
| src/pages/OperationsSummary.tsx:107 | daily_operations | select | useQuery in OperationsSummary page |
| src/pages/OperationsSummary.tsx:131 | service_development_entries | select | useQuery in OperationsSummary page |
| src/pages/OperationsSummary.tsx:149 | iop_patients | select | useQuery in OperationsSummary page |
| src/hooks/useDashboardData.ts:58 | facilities | select | useEffect in useDashboardData hook |
| src/hooks/useDashboardData.ts:75 | budget_sections | select | useEffect in useDashboardData hook |
| src/hooks/useDashboardData.ts:80 | budget_rows | select | useEffect in useDashboardData hook |
| src/hooks/useDashboardData.ts:105 | budget_years | select | useEffect in useDashboardData hook |
| src/hooks/useDashboardData.ts:122 | budgets | select | useEffect in useDashboardData hook |
| src/hooks/useDashboardData.ts:134 | daily_operations | select | useEffect in useDashboardData hook |
| src/hooks/useBudgetData.ts:75 | budget_years | select | useEffect in useBudgetData hook |
| src/hooks/useBudgetData.ts:97 | budget_sections | select | useEffect in useBudgetData hook |
| src/hooks/useBudgetData.ts:102 | budget_rows | select | useEffect in useBudgetData hook |
| src/hooks/useBudgetData.ts:173 | budget_years | select | useEffect in useBudgetData hook |
| src/hooks/useBudgetData.ts:191 | budget_years | insert | loadBudgetData() in useBudgetData hook |
| src/hooks/useBudgetData.ts:234 | budgets | select (paginated) | loadBudgetData() in useBudgetData hook |
| src/hooks/useBudgetData.ts:418 | budgets | delete | saveBudgetValues() in useBudgetData hook |
| src/hooks/useBudgetData.ts:438 | budgets | insert | saveBudgetValues() in useBudgetData hook |
| src/hooks/useIOPPatients.ts:61 | iop_patients | select | useQuery in useIOPPatients hook |
| src/hooks/useIOPPatients.ts:81 | iop_patients | select | useQuery (yesterday's data) |
| src/hooks/useIOPPatients.ts:102 | iop_patients | insert | addPatient mutation |
| src/hooks/useIOPPatients.ts:132 | iop_patients | delete | removePatient mutation |
| src/hooks/useIOPPatients.ts:157 | iop_patients | update | updatePatient mutation |
| src/hooks/useIOPPatients.ts:194 | iop_patients | insert | bulkAddPatients mutation |
| src/hooks/useUnitBudgetConfig.ts:96 | unit_budget_config | select | useEffect in useUnitBudgetConfig hook |
| src/hooks/useUnitBudgetConfig.ts:129 | unit_budget_config | select | useEffect in useUnitBudgetConfig hook |
| src/hooks/useUnitBudgetConfig.ts:137 | unit_budget_config | update | useMutation in useUnitBudgetConfig hook |
| src/hooks/useUnitBudgetConfig.ts:144 | unit_budget_config | insert | useMutation in useUnitBudgetConfig hook |
| src/hooks/useAdmitsDashboard.ts:56 | facilities | select | useEffect in useAdmitsDashboard hook |
| src/hooks/useAdmitsDashboard.ts:77 | units | select | useEffect in useAdmitsDashboard hook |
| src/hooks/useAdmitsDashboard.ts:108 | budget_years | select | useEffect in useAdmitsDashboard hook |
| src/hooks/useAdmitsDashboard.ts:121 | budget_rows | select | useEffect in useAdmitsDashboard hook |
| src/hooks/useAdmitsDashboard.ts:139 | units | select | useEffect in useAdmitsDashboard hook |
| src/hooks/useAdmitsDashboard.ts:151 | budgets | select | useEffect in useAdmitsDashboard hook |
| src/hooks/useAdmitsDashboard.ts:187 | units | select | useEffect in useAdmitsDashboard hook |
| src/hooks/useAdmitsDashboard.ts:201 | service_development_entries | select | useEffect in useAdmitsDashboard hook |
| src/hooks/useAdmitsDashboard.ts:247 | daily_operations | select | useEffect in useAdmitsDashboard hook |
| src/hooks/useAdmitsDashboard.ts:273 | iop_patients | select | useEffect in useAdmitsDashboard hook |
| src/hooks/useActivityLog.ts:58 | activity_logs | insert | logActivity() in useActivityLog hook |
| src/hooks/useServiceDevelopment.ts:67 | service_development_entries | select | useEffect in useServiceDevelopment hook |
| src/hooks/useServiceDevelopment.ts:146 | service_development_entries | delete | saveEntries() in useServiceDevelopment hook |
| src/hooks/useServiceDevelopment.ts:159 | service_development_entries | insert | saveEntries() in useServiceDevelopment hook |
| src/hooks/useServiceDevelopment.ts:185 | service_development_entries | select | loadEntries() in useServiceDevelopment hook |
| src/hooks/useDailyActuals.ts:34 | budget_years | select | useEffect in useDailyActuals hook |
| src/hooks/useDailyActuals.ts:54 | budget_rows | select | useEffect in useDailyActuals hook |
| src/hooks/useDailyActuals.ts:99 | actual_entries | select | useEffect in useDailyActuals hook |
| src/hooks/useDailyActuals.ts:157 | actual_entries | delete | saveEntries() in useDailyActuals hook |
| src/hooks/useDailyActuals.ts:183 | actual_entries | insert | saveEntries() in useDailyActuals hook |
| src/hooks/useDailyActuals.ts:206 | actual_entries | select | copyYesterday() in useDailyActuals hook |
| src/hooks/useProgramRankings.ts:288 | facilities | select | useEffect in useProgramRankings hook |
| src/hooks/useProgramRankings.ts:289 | units | select | useEffect in useProgramRankings hook |
| src/hooks/useProgramRankings.ts:290 | budget_rows | select | useEffect in useProgramRankings hook |
| src/hooks/useProgramRankings.ts:291 | budget_years | select | useEffect in useProgramRankings hook |
| src/hooks/useProgramRankings.ts:293 | program_ranking_daily_actuals | select | useEffect in useProgramRankings hook |
| src/hooks/useProgramRankings.ts:298 | daily_operations | select | useEffect in useProgramRankings hook |
| src/hooks/useProgramRankings.ts:328 | budgets | select | useEffect in useProgramRankings hook |
| src/hooks/useFacilityAccess.ts:42 | user_facility_assignments | select | useQuery in useFacilityAccess hook |
| src/hooks/useFacilityAccess.ts:57 | user_access_settings | select | useQuery in useFacilityAccess hook |
| src/hooks/useFacilityAccess.ts:107 | facilities | select | useQuery in useManageFacilityAssignments hook |
| src/hooks/useFacilityAccess.ts:122 | user_facility_assignments | select | useQuery in useManageFacilityAssignments hook |
| src/hooks/useFacilityAccess.ts:137 | user_access_settings | select | useQuery in useManageFacilityAssignments hook |
| src/hooks/useFacilityAccess.ts:151 | user_facility_assignments | insert | addAssignment mutation |
| src/hooks/useFacilityAccess.ts:164 | user_facility_assignments | delete | removeAssignment mutation |
| src/hooks/useFacilityAccess.ts:179 | user_access_settings | select | toggleViewAll mutation |
| src/hooks/useFacilityAccess.ts:186 | user_access_settings | update | toggleViewAll mutation |
| src/hooks/useFacilityAccess.ts:192 | user_access_settings | insert | toggleViewAll mutation |
| src/hooks/useDailyOperations.ts:471 | daily_operations | select | useEffect in useDailyOperations hook |
| src/hooks/useDailyOperations.ts:514 | daily_operations | insert | saveDailyOperations() |
| src/hooks/useDailyOperations.ts:549 | daily_operations | update | updateStatusDraft() |
| src/hooks/useKPISummary.ts:38 | daily_operations | select | useEffect in useKPISummary hook |
| src/hooks/useKPISummary.ts:66 | iop_patients | select | useEffect in useKPISummary hook |
| src/hooks/useKPISummary.ts:90 | service_development_entries | select | useEffect in useKPISummary hook |
| src/components/daily-operations/DailyOpsImportDialog.tsx:163 | daily_operations | select | queryFn in DailyOpsImportDialog |
| src/components/daily-operations/DailyOpsImportDialog.tsx:187 | daily_operations | update | async handler in DailyOpsImportDialog |
| src/components/daily-operations/DailyOpsImportDialog.tsx:193 | daily_operations | insert | async handler in DailyOpsImportDialog |
| src/components/budget/CSVImportDialog.tsx:652 | units | select | useEffect in CSVImportDialog |
| src/components/budget/CSVImportDialog.tsx:671 | facilities | select | Promise.all in CSVImportDialog |
| src/components/budget/CSVImportDialog.tsx:672 | budget_rows | select | Promise.all in CSVImportDialog |
| src/components/budget/CSVImportDialog.tsx:706 | budgets | select | useEffect in CSVImportDialog |
| src/components/budget/CSVImportDialog.tsx:727 | budgets | select | useEffect in CSVImportDialog |
| src/components/budget/CSVImportDialog.tsx:746 | budget_sections | select | useEffect in CSVImportDialog |
| src/components/budget/CSVImportDialog.tsx:1152 | budgets | delete | importCSV() in CSVImportDialog |
| src/components/budget/CSVImportDialog.tsx:1190 | budgets | insert | importCSV() in CSVImportDialog |
| src/components/admin/ComplianceReport.tsx:80 | facilities | select | useQuery in ComplianceReport |
| src/components/admin/ComplianceReport.tsx:87 | units | select | useQuery in ComplianceReport |
| src/components/admin/ComplianceReport.tsx:95 | daily_operations | select | useQuery in ComplianceReport |
| src/components/admin/MissingDaysReport.tsx:49 | facilities | select | Promise.all in MissingDaysReport |
| src/components/admin/MissingDaysReport.tsx:50 | units | select | Promise.all in MissingDaysReport |
| src/components/admin/MissingDaysReport.tsx:60 | daily_operations | select | queryFn in MissingDaysReport |
| src/components/admin/UnitsManagement.tsx:49 | facilities | select | useQuery in UnitsManagement |
| src/components/admin/UnitsManagement.tsx:61 | units | select | useQuery in UnitsManagement |
| src/components/admin/UnitsManagement.tsx:79 | units | update | saveUnitMutation in UnitsManagement |
| src/components/admin/UnitsManagement.tsx:85 | units | insert | saveUnitMutation in UnitsManagement |
| src/components/admin/UnitsManagement.tsx:106 | units | update | toggleUnitMutation in UnitsManagement |
| src/components/admin/ActivityLog.tsx:98 | activity_logs | select | useQuery in ActivityLog |
| src/components/admin/ActivityLog.tsx:125 | activity_logs | select (count) | useQuery in ActivityLog |

No `.rpc()` calls found anywhere in src/.

## Inventory 2: Role Helper Usage in App Code

| File:Line | Helper/Reference | Usage |
|-----------|-----------------|-------|
| src/integrations/supabase/types.ts:1216 | get_user_role | Generated type for DB function |
| src/integrations/supabase/types.ts:1220 | has_role | Generated type for DB function |
| src/integrations/supabase/types.ts:1190 | user_roles (table) | Generated table types |
| src/contexts/AuthContext.tsx:39 | user_roles (select) | fetchUserRole() reads role row |
| src/contexts/AuthContext.tsx:51 | role | Returns AppRole from DB or 'viewer' default |
| src/contexts/AuthContext.tsx:129-138 | isAdmin/isEditor/isNursing/isServiceDevelopment/isProgramAdministrator/isAdon/isDon/isHim/isSdd/isHumanResources | Context boolean helpers, one per role |
| src/contexts/AuthContext.tsx:139 | canEdit | Aggregated boolean over all non-viewer roles |
| src/pages/BudgetEntry.tsx:77 | canEdit | Controls budget edit permissions |
| src/pages/DailyOperations.tsx:133,142,144,146 | isAdmin/isNursing/isServiceDevelopment/role | Controls form-section visibility by role |
| src/pages/DailyOperations.tsx:478 | isAdmin | IOP rate configuration (admin only) |
| src/pages/DailyOperations.tsx:593,642,643,658,784,787 | isAdmin/role | Budget/rate/cost cards, edit controls admin-gated |
| src/pages/Admin.tsx:28,154 | isAdmin | Admin page access guard |
| src/components/layout/Sidebar.tsx:53,118 | role, isAdmin | Role display + admin nav link |
| src/components/admin/UserManagement.tsx:140,167,249,285,371,396,489,566,579,585,587 | role / roleLabels / roleIcons / roleColors | User CRUD + role assignment UI |
| src/hooks/useActivityLog.ts:47 | role | Captures current role in activity log rows |

## Architecture notes
- Two-layer role system: DB (user_roles + has_role/get_user_role SQL functions used only inside RLS policies) and client (AuthContext fetches user_roles once, exposes boolean helpers). No .rpc() usage.
- Separate facility-level access control: user_facility_assignments + user_access_settings via useFacilityAccess hook; DB-enforced only on program_ranking_daily_actuals.
- Tables referenced by app code (14): facilities, units, budget_years, budget_sections, budget_rows, budgets, actual_entries, daily_operations, service_development_entries, iop_patients, unit_budget_config, program_ranking_daily_actuals, activity_logs, user_facility_assignments, user_access_settings, user_roles, profiles (via auth), user_access_settings.
