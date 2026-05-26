import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2 } from 'lucide-react';
import { useManageFacilityAssignments } from '@/hooks/useFacilityAccess';
import { useToast } from '@/hooks/use-toast';

interface FacilityAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    full_name: string;
  } | null;
}

export default function FacilityAssignmentDialog({
  open,
  onOpenChange,
  user,
}: FacilityAssignmentDialogProps) {
  const { toast } = useToast();
  const {
    facilities,
    userAccessSettings,
    assignedFacilityIds,
    isLoading,
    addAssignment,
    removeAssignment,
    toggleViewAll,
  } = useManageFacilityAssignments(user?.id);

  const canViewAll = userAccessSettings?.can_view_all_facilities ?? false;

  const handleFacilityToggle = async (facilityId: string, checked: boolean) => {
    if (!user) return;
    
    try {
      if (checked) {
        await addAssignment.mutateAsync({ userId: user.id, facilityId });
      } else {
        await removeAssignment.mutateAsync({ userId: user.id, facilityId });
      }
    } catch (error) {
      toast({
        title: 'Error updating facility assignment',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleViewAllToggle = async (checked: boolean) => {
    if (!user) return;
    
    try {
      await toggleViewAll.mutateAsync({ userId: user.id, canViewAll: checked });
      toast({
        title: checked ? 'View All enabled' : 'View All disabled',
        description: checked 
          ? 'User can now view all facilities' 
          : 'User is now restricted to assigned facilities',
      });
    } catch (error) {
      toast({
        title: 'Error updating access settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Facility Access
          </DialogTitle>
          <DialogDescription>
            Manage facility access for <strong>{user?.full_name || user?.email}</strong>
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* View All Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="view-all" className="text-base font-medium">
                  Corporate Access (View All)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow user to view all facilities regardless of assignments
                </p>
              </div>
              <Switch
                id="view-all"
                checked={canViewAll}
                onCheckedChange={handleViewAllToggle}
                disabled={toggleViewAll.isPending}
              />
            </div>

            {/* Facility Assignments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Assigned Facilities</Label>
                {assignedFacilityIds.length > 0 && (
                  <Badge variant="secondary">
                    {assignedFacilityIds.length} assigned
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">
                {canViewAll 
                  ? 'User has corporate access and can view all facilities.'
                  : assignedFacilityIds.length === 0
                    ? 'No facilities assigned. User can view all facilities by default.'
                    : 'User can only view the selected facilities.'}
              </p>

              <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
                {facilities?.map((facility) => {
                  const isAssigned = assignedFacilityIds.includes(facility.id);
                  return (
                    <div
                      key={facility.id}
                      className="flex items-center space-x-3 p-3 hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`facility-${facility.id}`}
                        checked={isAssigned}
                        onCheckedChange={(checked) => 
                          handleFacilityToggle(facility.id, checked === true)
                        }
                        disabled={addAssignment.isPending || removeAssignment.isPending}
                      />
                      <Label
                        htmlFor={`facility-${facility.id}`}
                        className="flex-1 cursor-pointer text-sm font-normal"
                      >
                        <span className="font-medium">{facility.name}</span>
                        <span className="text-muted-foreground ml-2">({facility.code})</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
