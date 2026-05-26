import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Trash2, Users, CalendarIcon, X, Copy } from "lucide-react";
import { useIOPPatients } from "@/hooks/useIOPPatients";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface IOPPatientCardProps {
  unitId: string | null;
  facilityId: string | null;
  entryDate: Date;
  onTotalsChange?: (totalGroups: number, patientCount: number) => void;
}

export const IOPPatientCard = ({ unitId, facilityId, entryDate, onTotalsChange }: IOPPatientCardProps) => {
  const { patients, isLoading, addPatient, removePatient, updatePatient, copyFromYesterday, yesterdayPatients } = useIOPPatients(unitId, facilityId, entryDate);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [newPatient, setNewPatient] = useState({
    firstName: "",
    lastName: "",
    admitDate: format(new Date(), "yyyy-MM-dd"),
    dischargeDate: "",
    groupsAttended: 1,
  });

  // Calculate totals and notify parent
  useEffect(() => {
    if (onTotalsChange) {
      const totalGroups = patients.reduce((sum, p) => sum + p.groupsAttended, 0);
      onTotalsChange(totalGroups, patients.length);
    }
  }, [patients, onTotalsChange]);

  const handleAddPatient = async () => {
    if (!newPatient.firstName || !newPatient.lastName || !newPatient.admitDate) {
      return;
    }

    const formattedEntryDate = entryDate.toISOString().split('T')[0];

    await addPatient.mutateAsync({
      firstName: newPatient.firstName,
      lastName: newPatient.lastName,
      admitDate: newPatient.admitDate,
      dischargeDate: newPatient.dischargeDate || null,
      groupsAttended: newPatient.groupsAttended,
      entryDate: formattedEntryDate,
    });

    setNewPatient({
      firstName: "",
      lastName: "",
      admitDate: format(new Date(), "yyyy-MM-dd"),
      dischargeDate: "",
      groupsAttended: 1,
    });
    setIsDialogOpen(false);
  };

  const handleRemovePatient = async (patientId: string) => {
    await removePatient.mutateAsync(patientId);
  };

  const handleInlineUpdate = async (patientId: string, field: string, value: any) => {
    const updates: any = {};
    if (field === 'admitDate') updates.admitDate = value;
    if (field === 'dischargeDate') updates.dischargeDate = value || null;
    if (field === 'groupsAttended') updates.groupsAttended = parseInt(value);
    
    await updatePatient.mutateAsync({ patientId, updates });
  };

  const handleCopyYesterday = () => {
    setShowCopyConfirm(true);
  };

  const confirmCopyYesterday = async () => {
    await copyFromYesterday.mutateAsync();
    setShowCopyConfirm(false);
  };

  const totalGroupsAttended = patients.reduce((sum, p) => sum + p.groupsAttended, 0);
  const canCopyYesterday = yesterdayPatients.length > 0 && patients.length === 0;

  return (
    <Card className="border-teal-500/30 bg-teal-500/5">
      <CardHeader className="py-3 bg-teal-500/10 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
          <Users className="h-4 w-4" />
          <span>IOP Patients</span>
          <span className="text-xs font-normal text-muted-foreground">
            ({patients.length} patients, {totalGroupsAttended} groups)
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 h-7 text-xs"
                  onClick={handleCopyYesterday}
                  disabled={!canCopyYesterday || copyFromYesterday.isPending}
                >
                  <Copy className="h-3 w-3" />
                  Copy Yesterday
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {patients.length > 0
                  ? "Clear today's patients first to copy from yesterday"
                  : yesterdayPatients.length === 0
                  ? "No patients from yesterday to copy"
                  : `Copy ${yesterdayPatients.length} patient(s) from yesterday`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 h-7 text-xs">
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name (3 chars max)</Label>
                  <Input
                    id="firstName"
                    maxLength={3}
                    value={newPatient.firstName}
                    onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value.toUpperCase() })}
                    placeholder="ABC"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name (1 char max)</Label>
                  <Input
                    id="lastName"
                    maxLength={1}
                    value={newPatient.lastName}
                    onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value.toUpperCase() })}
                    placeholder="X"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="admitDate">Admit Date</Label>
                  <Input
                    id="admitDate"
                    type="date"
                    value={newPatient.admitDate}
                    onChange={(e) => setNewPatient({ ...newPatient, admitDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dischargeDate">Discharge Date</Label>
                  <Input
                    id="dischargeDate"
                    type="date"
                    value={newPatient.dischargeDate}
                    onChange={(e) => setNewPatient({ ...newPatient, dischargeDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="groupsAttended">Groups Attended</Label>
                <Select
                  value={newPatient.groupsAttended.toString()}
                  onValueChange={(value) => setNewPatient({ ...newPatient, groupsAttended: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddPatient} disabled={addPatient.isPending}>
                {addPatient.isPending ? "Adding..." : "Add Patient"}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="py-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading patients...</p>
        ) : patients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No patients added yet.</p>
        ) : (
          <div className="space-y-2">
            {/* Desktop table view */}
            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Admit</TableHead>
                    <TableHead className="text-xs">Discharge</TableHead>
                    <TableHead className="text-xs">Groups</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium text-sm py-2">
                        {patient.firstName} {patient.lastName}
                      </TableCell>
                      <TableCell className="py-2">
                        <Input
                          type="date"
                          className="h-7 w-28 text-xs"
                          value={patient.admitDate}
                          onChange={(e) => handleInlineUpdate(patient.id, 'admitDate', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="py-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-7 w-28 justify-start text-left text-xs font-normal",
                                !patient.dischargeDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-1 h-3 w-3" />
                              {patient.dischargeDate
                                ? format(parse(patient.dischargeDate, "yyyy-MM-dd", new Date()), "MM/dd/yy")
                                : "Set date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <div className="p-2 border-b flex justify-between items-center">
                              <span className="text-sm font-medium">Discharge Date</span>
                              {patient.dischargeDate && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs text-destructive hover:text-destructive"
                                  onClick={() => handleInlineUpdate(patient.id, 'dischargeDate', '')}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Clear
                                </Button>
                              )}
                            </div>
                            <Calendar
                              mode="single"
                              selected={patient.dischargeDate ? parse(patient.dischargeDate, "yyyy-MM-dd", new Date()) : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  handleInlineUpdate(patient.id, 'dischargeDate', format(date, "yyyy-MM-dd"));
                                }
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell className="py-2">
                        <Select
                          value={patient.groupsAttended.toString()}
                          onValueChange={(value) => handleInlineUpdate(patient.id, 'groupsAttended', value)}
                        >
                          <SelectTrigger className="h-7 w-14 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                {num}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRemovePatient(patient.id)}
                          disabled={removePatient.isPending}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-2">
              {patients.map((patient) => (
                <div key={patient.id} className="border rounded-md p-3 space-y-2 bg-background/50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {patient.firstName} {patient.lastName}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemovePatient(patient.id)}
                      disabled={removePatient.isPending}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Admit</Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={patient.admitDate}
                        onChange={(e) => handleInlineUpdate(patient.id, 'admitDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Discharge</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "w-full h-8 justify-start text-left text-xs font-normal",
                              !patient.dischargeDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {patient.dischargeDate
                              ? format(parse(patient.dischargeDate, "yyyy-MM-dd", new Date()), "MM/dd/yy")
                              : "Set date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-2 border-b flex justify-between items-center">
                            <span className="text-sm font-medium">Discharge Date</span>
                            {patient.dischargeDate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-destructive hover:text-destructive"
                                onClick={() => handleInlineUpdate(patient.id, 'dischargeDate', '')}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                            )}
                          </div>
                          <Calendar
                            mode="single"
                            selected={patient.dischargeDate ? parse(patient.dischargeDate, "yyyy-MM-dd", new Date()) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                handleInlineUpdate(patient.id, 'dischargeDate', format(date, "yyyy-MM-dd"));
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Groups Attended</Label>
                    <Select
                      value={patient.groupsAttended.toString()}
                      onValueChange={(value) => handleInlineUpdate(patient.id, 'groupsAttended', value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={showCopyConfirm} onOpenChange={setShowCopyConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will copy yesterday's patients into today's list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCopyYesterday}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
