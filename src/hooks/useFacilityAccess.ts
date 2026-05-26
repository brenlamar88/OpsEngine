import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FacilityAssignment {
  id: string;
  user_id: string;
  facility_id: string;
  created_at: string;
}

interface UserAccessSettings {
  id: string;
  user_id: string;
  can_view_all_facilities: boolean;
  created_at: string;
  updated_at: string;
}

interface Facility {
  id: string;
  name: string;
  code: string;
  is_active?: boolean;
}

interface FilterableFacility {
  id: string;
  name: string;
  code?: string;
}

export function useFacilityAccess() {
  const { user } = useAuth();

  // Fetch current user's facility assignments
  const { data: userAssignments } = useQuery({
    queryKey: ['user-facility-assignments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_facility_assignments')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as FacilityAssignment[];
    },
    enabled: !!user?.id,
  });

  // Fetch current user's access settings
  const { data: accessSettings } = useQuery({
    queryKey: ['user-access-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_access_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserAccessSettings | null;
    },
    enabled: !!user?.id,
  });

  const canViewAllFacilities = accessSettings?.can_view_all_facilities ?? false;
  const hasAssignedFacilities = (userAssignments?.length ?? 0) > 0;
  const assignedFacilityIds = userAssignments?.map(a => a.facility_id) ?? [];

  // User can view all if: admin, has "view all" setting, or has no facility assignments
  const shouldViewAll = canViewAllFacilities || !hasAssignedFacilities;

  // Filter facilities based on user's access
  const filterFacilities = <T extends FilterableFacility>(facilities: T[]): T[] => {
    if (shouldViewAll) return facilities;
    return facilities.filter(f => assignedFacilityIds.includes(f.id));
  };

  // Check if user can view a specific facility
  const canViewFacility = (facilityId: string): boolean => {
    if (shouldViewAll) return true;
    return assignedFacilityIds.includes(facilityId);
  };

  return {
    userAssignments,
    accessSettings,
    canViewAllFacilities,
    hasAssignedFacilities,
    assignedFacilityIds,
    shouldViewAll,
    filterFacilities,
    canViewFacility,
  };
}

// Hook for admin to manage user facility assignments
export function useManageFacilityAssignments(userId?: string) {
  const queryClient = useQueryClient();

  // Fetch all facilities
  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Facility[];
    },
  });

  // Fetch specific user's facility assignments
  const { data: userAssignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['user-facility-assignments', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_facility_assignments')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      return data as FacilityAssignment[];
    },
    enabled: !!userId,
  });

  // Fetch specific user's access settings
  const { data: userAccessSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['user-access-settings', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_access_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as UserAccessSettings | null;
    },
    enabled: !!userId,
  });

  // Add facility assignment
  const addAssignment = useMutation({
    mutationFn: async ({ userId, facilityId }: { userId: string; facilityId: string }) => {
      const { error } = await supabase
        .from('user_facility_assignments')
        .insert({ user_id: userId, facility_id: facilityId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-facility-assignments', userId] });
    },
  });

  // Remove facility assignment
  const removeAssignment = useMutation({
    mutationFn: async ({ userId, facilityId }: { userId: string; facilityId: string }) => {
      const { error } = await supabase
        .from('user_facility_assignments')
        .delete()
        .eq('user_id', userId)
        .eq('facility_id', facilityId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-facility-assignments', userId] });
    },
  });

  // Toggle "view all" setting
  const toggleViewAll = useMutation({
    mutationFn: async ({ userId, canViewAll }: { userId: string; canViewAll: boolean }) => {
      const { data: existing } = await supabase
        .from('user_access_settings')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_access_settings')
          .update({ can_view_all_facilities: canViewAll })
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_access_settings')
          .insert({ user_id: userId, can_view_all_facilities: canViewAll });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-access-settings', userId] });
    },
  });

  const assignedFacilityIds = userAssignments?.map(a => a.facility_id) ?? [];

  return {
    facilities,
    userAssignments,
    userAccessSettings,
    assignedFacilityIds,
    isLoading: assignmentsLoading || settingsLoading,
    addAssignment,
    removeAssignment,
    toggleViewAll,
  };
}
