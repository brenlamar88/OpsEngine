import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Search, RefreshCw, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const actionLabels: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  view_page: 'View Page',
  create_user: 'Create User',
  update_user_role: 'Update User Role',
  delete_user: 'Delete User',
  reset_password: 'Reset Password',
  save_daily_operations: 'Save Daily Operations',
  save_budget: 'Save Budget',
  import_csv: 'Import CSV',
  export_csv: 'Export CSV',
  export_pdf: 'Export PDF',
  create_facility: 'Create Facility',
  update_facility: 'Update Facility',
  create_unit: 'Create Unit',
  update_unit: 'Update Unit',
  create_iop_patient: 'Create IOP Patient',
  update_iop_patient: 'Update IOP Patient',
  discharge_iop_patient: 'Discharge IOP Patient',
  seed_budget_structure: 'Seed Budget Structure',
  send_invite: 'Send Invite',
  send_bulk_invites: 'Send Bulk Invites',
};

const actionColors: Record<string, string> = {
  login: 'bg-green-500/10 text-green-600 border-green-500/20',
  logout: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  create_user: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  update_user_role: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  delete_user: 'bg-red-500/10 text-red-600 border-red-500/20',
  reset_password: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  save_daily_operations: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  save_budget: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  import_csv: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  export_csv: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  export_pdf: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  create_facility: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  update_facility: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  create_unit: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  update_unit: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  send_invite: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  send_bulk_invites: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
  nursing: 'Nursing',
  service_development: 'Service Dev',
  program_administrator: 'Program Admin',
  adon: 'ADON',
  don: 'DON',
  him: 'HIM',
  sdd: 'SDD',
  human_resources: 'HR',
};

const LOGS_PER_PAGE = 20;

export default function ActivityLog() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['activity-logs', currentPage, searchQuery, actionFilter, roleFilter],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * LOGS_PER_PAGE, currentPage * LOGS_PER_PAGE - 1);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      if (roleFilter !== 'all') {
        query = query.eq('user_role', roleFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(`user_email.ilike.%${searchQuery}%,action.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityLogEntry[];
    },
  });

  const { data: totalCount } = useQuery({
    queryKey: ['activity-logs-count', searchQuery, actionFilter, roleFilter],
    queryFn: async () => {
      let query = supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true });

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      if (roleFilter !== 'all') {
        query = query.eq('user_role', roleFilter);
      }

      if (searchQuery.trim()) {
        query = query.or(`user_email.ilike.%${searchQuery}%,action.ilike.%${searchQuery}%`);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('activity-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const totalPages = Math.ceil((totalCount || 0) / LOGS_PER_PAGE);

  const handleExportCSV = () => {
    if (!logs || logs.length === 0) return;

    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Resource Type', 'Resource ID', 'Details'];
    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        `"${format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}"`,
        `"${log.user_email.replace(/"/g, '""')}"`,
        `"${roleLabels[log.user_role] || log.user_role}"`,
        `"${actionLabels[log.action] || log.action}"`,
        `"${log.resource_type || ''}"`,
        `"${log.resource_id || ''}"`,
        `"${log.details ? JSON.stringify(log.details).replace(/"/g, '""') : ''}"`,
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity_log_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const uniqueActions = Object.keys(actionLabels);
  const uniqueRoles = Object.keys(roleLabels);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>Track user actions across the system</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!logs || logs.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or action..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={actionFilter}
              onValueChange={(value) => {
                setActionFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>
                    {actionLabels[action]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={roleFilter}
              onValueChange={(value) => {
                setRoleFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {uniqueRoles.map(role => (
                  <SelectItem key={role} value={role}>
                    {roleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="h-[500px] rounded-md border">
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading activity logs...
                    </TableCell>
                  </TableRow>
                ) : logs && logs.length > 0 ? (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">
                        {log.user_email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {roleLabels[log.user_role] || log.user_role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${actionColors[log.action] || 'bg-gray-500/10 text-gray-600'}`}
                        >
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.resource_type && (
                          <span>
                            {log.resource_type}
                            {log.resource_id && <span className="text-xs ml-1">({log.resource_id.slice(0, 8)}...)</span>}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.details ? JSON.stringify(log.details) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * LOGS_PER_PAGE) + 1} to {Math.min(currentPage * LOGS_PER_PAGE, totalCount || 0)} of {totalCount} entries
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
