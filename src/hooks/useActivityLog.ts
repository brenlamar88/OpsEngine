import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';
import type { Json } from '@/integrations/supabase/types';
export type ActivityAction = 
  | 'login'
  | 'logout'
  | 'view_page'
  | 'create_user'
  | 'update_user_role'
  | 'delete_user'
  | 'reset_password'
  | 'save_daily_operations'
  | 'save_budget'
  | 'import_csv'
  | 'export_csv'
  | 'export_pdf'
  | 'create_facility'
  | 'update_facility'
  | 'create_unit'
  | 'update_unit'
  | 'create_iop_patient'
  | 'update_iop_patient'
  | 'discharge_iop_patient'
  | 'seed_budget_structure'
  | 'send_invite'
  | 'send_bulk_invites';

export type ResourceType = 
  | 'user'
  | 'facility'
  | 'unit'
  | 'daily_operations'
  | 'budget'
  | 'iop_patient'
  | 'report'
  | 'system';

interface LogActivityParams {
  action: ActivityAction;
  resourceType?: ResourceType;
  resourceId?: string;
  details?: Json;
}

export function useActivityLog() {
  const { user, role } = useAuth();

  const logActivity = useCallback(async ({
    action,
    resourceType,
    resourceId,
    details,
  }: LogActivityParams) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('activity_logs').insert([{
        user_id: user.id,
        user_email: user.email || 'unknown',
        user_role: role || 'unknown',
        action,
        resource_type: resourceType || null,
        resource_id: resourceId || null,
        details: details || null,
      }]);

      if (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  }, [user, role]);

  return { logActivity };
}
