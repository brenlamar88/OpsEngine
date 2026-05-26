import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useActivityLog } from '@/hooks/useActivityLog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Plus, Loader2, Trash2, Shield, ShieldCheck, Eye, KeyRound, Mail, Send, Search, Download, Building2 } from 'lucide-react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { format } from 'date-fns';
import FacilityAssignmentDialog from './FacilityAssignmentDialog';

type AppRole = 'admin' | 'editor' | 'viewer' | 'nursing' | 'service_development' | 'program_administrator' | 'adon' | 'don' | 'him' | 'sdd' | 'human_resources';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  created_at: string;
  last_sign_in_at: string | null;
}

const roleIcons: Record<AppRole, typeof ShieldCheck> = {
  admin: ShieldCheck,
  editor: Shield,
  viewer: Eye,
  nursing: Shield,
  service_development: Shield,
  program_administrator: Shield,
  adon: Shield,
  don: Shield,
  him: Shield,
  sdd: Shield,
  human_resources: Shield,
};

const roleColors: Record<AppRole, string> = {
  admin: 'text-red-500',
  editor: 'text-blue-500',
  viewer: 'text-muted-foreground',
  nursing: 'text-green-500',
  service_development: 'text-purple-500',
  program_administrator: 'text-orange-500',
  adon: 'text-teal-500',
  don: 'text-cyan-500',
  him: 'text-amber-500',
  sdd: 'text-pink-500',
  human_resources: 'text-indigo-500',
};

const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
  nursing: 'Nursing',
  service_development: 'Service Development',
  program_administrator: 'Program Administrator',
  adon: 'ADON',
  don: 'DON',
  him: 'HIM',
  sdd: 'SDD',
  human_resources: 'Human Resources',
};

const USERS_PER_PAGE = 15;

export default function UserManagement() {
  const { session, user: currentUser } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [facilityAssignmentUser, setFacilityAssignmentUser] = useState<User | null>(null);
  const [facilityDialogOpen, setFacilityDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'viewer' as AppRole,
  });

  const loginUrl = window.location.origin + '/auth';

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Refresh session to ensure token is valid
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No valid session');
      
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data.users as User[];
    },
    enabled: !!session?.access_token,
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof createForm & { send_welcome_email: boolean }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No valid session');
      
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'create', 
          ...userData,
          login_url: loginUrl,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      const emailMsg = data.email_sent?.success ? ' Welcome email sent.' : '';
      toast({ title: `User created successfully.${emailMsg}` });
      logActivity({ action: 'create_user', resourceType: 'user', details: { email: createForm.email, role: createForm.role } as any });
      setCreateDialogOpen(false);
      setCreateForm({ email: '', password: '', full_name: '', role: 'viewer' });
      setSendWelcomeEmail(true);
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating user', description: error.message, variant: 'destructive' });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No valid session');
      
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'update_role', user_id, role },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Role updated successfully' });
      logActivity({ action: 'update_user_role', resourceType: 'user', resourceId: variables.user_id, details: { new_role: variables.role } as any });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating role', description: error.message, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (user_id: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No valid session');
      
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', user_id },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'User deleted successfully' });
      logActivity({ action: 'delete_user', resourceType: 'user', resourceId: userId });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting user', description: error.message, variant: 'destructive' });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ user_id, new_password }: { user_id: string; new_password: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No valid session');
      
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'reset_password', user_id, new_password },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) {
        // FunctionsHttpError hides the response body. Try to read it for a friendly message.
        let serverMessage: string | null = null;
        try {
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) serverMessage = body.error as string;
          }
        } catch {
          // ignore parse errors, fall back to default error message
        }
        throw new Error(serverMessage ?? error.message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Password reset successfully' });
      logActivity({ action: 'reset_password', resourceType: 'user', resourceId: resetPasswordUser?.id });
      setResetPasswordDialogOpen(false);
      setResetPasswordUser(null);
      setNewPassword('');
    },
    onError: (error: Error) => {
      toast({ title: 'Error resetting password', description: error.message, variant: 'destructive' });
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (user: User) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No valid session');
      
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'send_invite', 
          user_id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          login_url: loginUrl,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Invite sent successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error sending invite', description: error.message, variant: 'destructive' });
    },
  });

  const sendBulkInvitesMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No valid session');
      
      // Get users who haven't signed in yet
      const usersToInvite = users?.filter(u => !u.last_sign_in_at && u.id !== currentUser?.id) || [];
      if (usersToInvite.length === 0) {
        throw new Error('No users to invite');
      }
      
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { 
          action: 'send_bulk_invites', 
          users: usersToInvite.map(u => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
          })),
          login_url: loginUrl,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Bulk invites sent', 
        description: `${data.successCount} of ${data.totalCount} emails sent successfully` 
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error sending bulk invites', description: error.message, variant: 'destructive' });
    },
  });

  const handleCreateUser = () => {
    const trimmedEmail = createForm.email.trim().toLowerCase();
    const trimmedPassword = createForm.password.trim();
    
    if (!trimmedEmail || !trimmedPassword) {
      toast({ title: 'Email and password are required', variant: 'destructive' });
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast({ title: 'Please enter a valid email address', variant: 'destructive' });
      return;
    }
    
    if (trimmedPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    
    createUserMutation.mutate({ 
      ...createForm, 
      email: trimmedEmail,
      password: trimmedPassword,
      send_welcome_email: sendWelcomeEmail 
    });
  };

  const handleResetPassword = () => {
    if (!newPassword.trim()) {
      toast({ title: 'Password is required', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (resetPasswordUser) {
      resetPasswordMutation.mutate({ user_id: resetPasswordUser.id, new_password: newPassword });
    }
  };

  const openResetPasswordDialog = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setResetPasswordDialogOpen(true);
  };

  const openFacilityAssignmentDialog = (user: User) => {
    setFacilityAssignmentUser(user);
    setFacilityDialogOpen(true);
  };

  const usersWithoutSignIn = users?.filter(u => !u.last_sign_in_at && u.id !== currentUser?.id) || [];

  const handleExportCSV = () => {
    if (!users || users.length === 0) return;
    
    const headers = ['Full Name', 'Email', 'Role', 'Created', 'Last Sign In'];
    const csvRows = [
      headers.join(','),
      ...users.map(user => [
        `"${(user.full_name || 'No name').replace(/"/g, '""')}"`,
        `"${user.email.replace(/"/g, '""')}"`,
        `"${roleLabels[user.role]}"`,
        `"${format(new Date(user.created_at), 'MMM d, yyyy')}"`,
        `"${user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM d, yyyy') : 'Never'}"`
      ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter users by search query
  const filteredUsers = users?.filter(user => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      (user.full_name && user.full_name.toLowerCase().includes(query)) ||
      roleLabels[user.role].toLowerCase().includes(query)
    );
  }) || [];

  // Pagination logic
  const totalUsers = filteredUsers.length;
  const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);
  const startIndex = (currentPage - 1) * USERS_PER_PAGE;
  const endIndex = startIndex + USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to page 1 if current page is out of bounds or when search changes
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>Create and manage users and their roles.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            disabled={!users || users.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          {usersWithoutSignIn.length > 0 && (
            <Button 
              variant="outline" 
              onClick={() => sendBulkInvitesMutation.mutate()}
              disabled={sendBulkInvitesMutation.isPending}
            >
              {sendBulkInvitesMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send All Invites ({usersWithoutSignIn.length})
            </Button>
          )}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={createForm.full_name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(value) => setCreateForm((f) => ({ ...f, role: value as AppRole }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="nursing">Nursing</SelectItem>
                      <SelectItem value="service_development">Service Development</SelectItem>
                      <SelectItem value="program_administrator">Program Administrator</SelectItem>
                      <SelectItem value="adon">ADON</SelectItem>
                      <SelectItem value="don">DON</SelectItem>
                      <SelectItem value="him">HIM</SelectItem>
                      <SelectItem value="sdd">SDD</SelectItem>
                      <SelectItem value="human_resources">Human Resources</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="send_welcome_email"
                    checked={sendWelcomeEmail}
                    onCheckedChange={(checked) => setSendWelcomeEmail(checked === true)}
                  />
                  <Label htmlFor="send_welcome_email" className="text-sm font-normal cursor-pointer">
                    Send welcome email with login credentials
                  </Label>
                </div>
                <Button onClick={handleCreateUser} className="w-full" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search Filter */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className="pl-9"
          />
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !users?.length ? (
          <p className="text-center text-muted-foreground py-8">No users found.</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No users match your search.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((user) => {
                  const RoleIcon = roleIcons[user.role];
                  const isCurrentUser = user.id === currentUser?.id;
                  
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name || 'No name'}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          onValueChange={(value) => updateRoleMutation.mutate({ user_id: user.id, role: value })}
                          disabled={isCurrentUser || updateRoleMutation.isPending}
                        >
                          <SelectTrigger className="w-32">
                              <SelectValue>
                              <span className={`flex items-center gap-2 ${roleColors[user.role]}`}>
                                <RoleIcon className="h-4 w-4" />
                                {roleLabels[user.role]}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">
                              <span className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Viewer
                              </span>
                            </SelectItem>
                            <SelectItem value="editor">
                              <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Editor
                              </span>
                            </SelectItem>
                            <SelectItem value="nursing">
                              <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Nursing
                              </span>
                            </SelectItem>
                            <SelectItem value="service_development">
                              <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Service Development
                              </span>
                            </SelectItem>
                            <SelectItem value="program_administrator">
                              <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Program Administrator
                              </span>
                            </SelectItem>
                            <SelectItem value="adon">
                              <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                ADON
                              </span>
                            </SelectItem>
                            <SelectItem value="don">
                              <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                DON
                              </span>
                            </SelectItem>
                            <SelectItem value="him">
                              <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                HIM
                              </span>
                            </SelectItem>
                            <SelectItem value="sdd">
                              <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                SDD
                              </span>
                            </SelectItem>
                            <SelectItem value="human_resources">
                              <span className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Human Resources
                              </span>
                            </SelectItem>
                            <SelectItem value="admin">
                              <span className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" />
                                Admin
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM d, yyyy') : 'Never'}
                      </TableCell>
                      <TableCell>
                        {!isCurrentUser && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openFacilityAssignmentDialog(user)}
                              title="Facility Access"
                            >
                              <Building2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => sendInviteMutation.mutate(user)}
                              disabled={sendInviteMutation.isPending}
                              title="Send Invite Email"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openResetPasswordDialog(user)}
                              title="Reset Password"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {user.email}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUserMutation.mutate(user.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalUsers)} of {totalUsers} users
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
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
          </>
        )}

        {/* Reset Password Dialog */}
        <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-sm text-muted-foreground">
                Set a new password for <strong>{resetPasswordUser?.email}</strong>
              </p>
              <div>
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button onClick={handleResetPassword} className="w-full" disabled={resetPasswordMutation.isPending}>
                {resetPasswordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reset Password
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Facility Assignment Dialog */}
        <FacilityAssignmentDialog
          open={facilityDialogOpen}
          onOpenChange={setFacilityDialogOpen}
          user={facilityAssignmentUser}
        />
      </CardContent>
    </Card>
  );
}
