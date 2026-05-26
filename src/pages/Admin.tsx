import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, Settings, Loader2, CheckCircle, AlertCircle, Building2, Plus, Pencil } from 'lucide-react';
import UserManagement from '@/components/admin/UserManagement';
import UnitsManagement from '@/components/admin/UnitsManagement';
import ActivityLog from '@/components/admin/ActivityLog';
import ComplianceReport from '@/components/admin/ComplianceReport';
import MissingDaysReport from '@/components/admin/MissingDaysReport';

interface Facility {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

export default function Admin() {
  const { isAdmin, session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<'success' | 'error' | null>(null);
  const [facilityDialogOpen, setFacilityDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [facilityForm, setFacilityForm] = useState({ name: '', code: '' });

  const { data: facilities, isLoading: loadingFacilities } = useQuery({
    queryKey: ['facilities-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Facility[];
    },
  });

  const saveFacilityMutation = useMutation({
    mutationFn: async (facility: { id?: string; name: string; code: string }) => {
      if (facility.id) {
        const { error } = await supabase
          .from('facilities')
          .update({ name: facility.name, code: facility.code })
          .eq('id', facility.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('facilities')
          .insert({ name: facility.name, code: facility.code });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities-admin'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      toast({ title: editingFacility ? 'Facility updated' : 'Facility created' });
      setFacilityDialogOpen(false);
      setEditingFacility(null);
      setFacilityForm({ name: '', code: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving facility', description: error.message, variant: 'destructive' });
    },
  });

  const toggleFacilityMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('facilities')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities-admin'] });
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });

  const handleSeedBudgetStructure = async () => {
    if (!session?.access_token) {
      toast({
        title: 'Not authenticated',
        description: 'Please log in to seed the budget structure.',
        variant: 'destructive',
      });
      return;
    }

    setSeeding(true);
    setSeedResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('seed-budget-structure', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setSeedResult('success');
        toast({ title: 'Budget structure seeded', description: data.message });
      } else {
        setSeedResult('error');
        toast({ title: 'Seeding failed', description: data?.message || 'Unknown error', variant: 'destructive' });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error seeding budget structure:', error);
      setSeedResult('error');
      toast({ title: 'Error seeding budget structure', description: message, variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const openEditDialog = (facility: Facility) => {
    setEditingFacility(facility);
    setFacilityForm({ name: facility.name, code: facility.code });
    setFacilityDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingFacility(null);
    setFacilityForm({ name: '', code: '' });
    setFacilityDialogOpen(true);
  };

  const handleSaveFacility = () => {
    if (!facilityForm.name.trim() || !facilityForm.code.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    saveFacilityMutation.mutate({
      id: editingFacility?.id,
      name: facilityForm.name.trim(),
      code: facilityForm.code.trim().toUpperCase(),
    });
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>You need admin privileges to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Settings</h1>
        <p className="mt-2 text-muted-foreground">Manage budget structure, facilities, users, and system settings.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Seed Budget Structure Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Budget Structure
            </CardTitle>
            <CardDescription>Seed the database with the default budget sections and rows.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleSeedBudgetStructure} disabled={seeding} className="w-full" variant={seedResult === 'success' ? 'secondary' : 'default'}>
              {seeding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Seeding...
                </>
              ) : seedResult === 'success' ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Seeded Successfully
                </>
              ) : (
                'Seed Budget Structure'
              )}
            </Button>
            {seedResult === 'error' && <p className="mt-2 text-sm text-destructive">Seeding failed. The structure may already exist.</p>}
          </CardContent>
        </Card>


        {/* System Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Settings
            </CardTitle>
            <CardDescription>Configure application settings and preferences.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* User Management Section */}
      <UserManagement />

      {/* Facility Management Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Facility Management
            </CardTitle>
            <CardDescription>Create and manage facilities for budget tracking.</CardDescription>
          </div>
          <Dialog open={facilityDialogOpen} onOpenChange={setFacilityDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Facility
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingFacility ? 'Edit Facility' : 'Create Facility'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={facilityForm.name}
                    onChange={(e) => setFacilityForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Main Hospital"
                  />
                </div>
                <div>
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={facilityForm.code}
                    onChange={(e) => setFacilityForm((f) => ({ ...f, code: e.target.value }))}
                    placeholder="MH01"
                    className="uppercase"
                  />
                </div>
                <Button onClick={handleSaveFacility} className="w-full" disabled={saveFacilityMutation.isPending}>
                  {saveFacilityMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingFacility ? 'Update Facility' : 'Create Facility'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loadingFacilities ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !facilities?.length ? (
            <p className="text-center text-muted-foreground py-8">No facilities yet. Add one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="w-24">Active</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facilities.map((facility) => (
                  <TableRow key={facility.id}>
                    <TableCell className="font-medium">{facility.name}</TableCell>
                    <TableCell className="font-mono">{facility.code}</TableCell>
                    <TableCell>
                      <Switch
                        checked={facility.is_active}
                        onCheckedChange={(checked) => toggleFacilityMutation.mutate({ id: facility.id, is_active: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(facility)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Units Management Section */}
      <UnitsManagement />

      {/* Compliance Report Section */}
      <ComplianceReport />
      <MissingDaysReport />

      {/* Activity Log Section */}
      <div className="mt-6">
        <ActivityLog />
      </div>
    </div>
  );
}