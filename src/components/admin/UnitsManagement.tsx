import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Layers } from 'lucide-react';

interface Facility {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

type UnitType = 'INPATIENT' | 'IOP' | 'LTAC' | 'RHC' | 'FORENSIC';

interface Unit {
  id: string;
  name: string;
  facility_id: string;
  is_active: boolean;
  unit_type: UnitType;
  facility?: {
    id: string;
    name: string;
    code: string;
  };
}

export default function UnitsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFacility, setSelectedFacility] = useState<string>('all');
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState({ name: '', facility_id: '', unit_type: 'INPATIENT' as UnitType, programName: '' });

  const { data: facilities } = useQuery({
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

  const { data: units, isLoading: loadingUnits } = useQuery({
    queryKey: ['units-admin', selectedFacility],
    queryFn: async () => {
      let query = supabase
        .from('units')
        .select('*, facility:facilities(id, name, code)')
        .order('name');
      
      if (selectedFacility !== 'all') {
        query = query.eq('facility_id', selectedFacility);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Unit[];
    },
  });

  const saveUnitMutation = useMutation({
    mutationFn: async (unit: { id?: string; name: string; facility_id: string; unit_type: UnitType }) => {
      if (unit.id) {
        const { error } = await supabase
          .from('units')
          .update({ name: unit.name, facility_id: unit.facility_id, unit_type: unit.unit_type })
          .eq('id', unit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('units')
          .insert({ name: unit.name, facility_id: unit.facility_id, unit_type: unit.unit_type });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-admin'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast({ title: editingUnit ? 'Unit updated' : 'Unit created' });
      setUnitDialogOpen(false);
      setEditingUnit(null);
      setUnitForm({ name: '', facility_id: '', unit_type: 'INPATIENT', programName: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error saving unit', description: error.message, variant: 'destructive' });
    },
  });

  const toggleUnitMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('units')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-admin'] });
      queryClient.invalidateQueries({ queryKey: ['units'] });
    },
  });

  const openEditDialog = (unit: Unit) => {
    setEditingUnit(unit);
    // For IOP units, extract the program name; for others, the name is the unit type
    const isIOP = unit.unit_type === 'IOP';
    setUnitForm({ 
      name: isIOP ? 'IOP' : unit.name, 
      facility_id: unit.facility_id, 
      unit_type: unit.unit_type,
      programName: isIOP ? unit.name : ''
    });
    setUnitDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingUnit(null);
    setUnitForm({ name: '', facility_id: selectedFacility !== 'all' ? selectedFacility : '', unit_type: 'INPATIENT', programName: '' });
    setUnitDialogOpen(true);
  };

  const handleSaveUnit = async () => {
    const isIOP = unitForm.unit_type === 'IOP';
    
    // For IOP, require program name; for others, require unit type selection
    if (!unitForm.name.trim() || !unitForm.facility_id) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    if (isIOP && !unitForm.programName.trim()) {
      toast({ title: 'Please enter a program name for the IOP unit', variant: 'destructive' });
      return;
    }

    // Determine the final name: for IOP use custom program name, otherwise use the selected type
    const finalName = isIOP ? unitForm.programName.trim() : unitForm.name.trim();

    // Check for duplicate unit name in the same facility
    const existingUnit = units?.find(
      (u) => u.name === finalName && u.facility_id === unitForm.facility_id && u.id !== editingUnit?.id
    );

    if (existingUnit) {
      toast({ 
        title: 'Duplicate unit name', 
        description: `A unit named "${finalName}" already exists for this facility.`,
        variant: 'destructive' 
      });
      return;
    }

    saveUnitMutation.mutate({
      id: editingUnit?.id,
      name: finalName,
      facility_id: unitForm.facility_id,
      unit_type: unitForm.unit_type,
    });
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Units Management
          </CardTitle>
          <CardDescription>Create and manage units (service lines) for each facility.</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedFacility} onValueChange={setSelectedFacility}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by facility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Facilities</SelectItem>
              {facilities?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Unit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUnit ? 'Edit Unit' : 'Create Unit'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="facility">Facility</Label>
                  <Select 
                    value={unitForm.facility_id} 
                    onValueChange={(v) => setUnitForm((f) => ({ ...f, facility_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select facility" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilities?.filter(f => f.is_active !== false).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="unit-type">Unit Type</Label>
                  <Select 
                    value={unitForm.name} 
                    onValueChange={(v) => {
                      // Auto-set unit_type based on name selection
                      let newUnitType: UnitType = 'INPATIENT';
                      if (v === 'IOP') newUnitType = 'IOP';
                      else if (v === 'LTAC') newUnitType = 'LTAC';
                      else if (v === 'RHC') newUnitType = 'RHC';
                      else if (v === 'FORENSIC') newUnitType = 'FORENSIC';
                      setUnitForm((f) => ({ ...f, name: v, unit_type: newUnitType, programName: v === 'IOP' ? f.programName : '' }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADULT">ADULT (Inpatient)</SelectItem>
                      <SelectItem value="GERI">GERI (Inpatient)</SelectItem>
                      <SelectItem value="LTAC">LTAC (Inpatient)</SelectItem>
                      <SelectItem value="RHC">RHC (Inpatient)</SelectItem>
                      <SelectItem value="FORENSIC">FORENSIC (Inpatient)</SelectItem>
                      <SelectItem value="IOP">IOP (Outpatient)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {unitForm.unit_type === 'IOP' && (
                  <div>
                    <Label htmlFor="program-name">Program Name</Label>
                    <Input
                      id="program-name"
                      placeholder="e.g., IOP - Adult, IOP - Adolescent"
                      value={unitForm.programName}
                      onChange={(e) => setUnitForm((f) => ({ ...f, programName: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter a unique name for this IOP program
                    </p>
                  </div>
                )}
                <Button onClick={handleSaveUnit} className="w-full" disabled={saveUnitMutation.isPending}>
                  {saveUnitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingUnit ? 'Update Unit' : 'Create Unit'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loadingUnits ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !units?.length ? (
          <p className="text-center text-muted-foreground py-8">
            No units found. {selectedFacility === 'all' ? 'Add a unit to get started.' : 'Add a unit to this facility.'}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit Name</TableHead>
                <TableHead>Budget Type</TableHead>
                <TableHead>Facility</TableHead>
                <TableHead className="w-24">Active</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      unit.unit_type === 'IOP' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                        : unit.unit_type === 'LTAC'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                          : unit.unit_type === 'RHC'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : unit.unit_type === 'FORENSIC'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}>
                      {unit.unit_type === 'IOP' ? 'Outpatient' : unit.unit_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    {unit.facility ? `${unit.facility.name} (${unit.facility.code})` : '—'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={unit.is_active}
                      onCheckedChange={(checked) => toggleUnitMutation.mutate({ id: unit.id, is_active: checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(unit)}>
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
  );
}
