import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, subDays } from 'date-fns';

export type Territory = 'Red' | 'White' | 'Blue';

export const TERRITORIES: Territory[] = ['Red', 'White', 'Blue'];

export const SERVICE_DEV_METRICS = [
  { key: 'inquiries', label: 'Inquiries', type: 'number' },
  { key: 'referrals', label: 'Referrals', type: 'number' },
  { key: 'admits', label: 'Admits', type: 'number' },
  { key: 'face_to_face_touches', label: 'Face to Face Touches', type: 'number' },
  { key: 'quality_touches', label: 'Quality Touches', type: 'number' },
  { key: 'inservices', label: 'Inservices', type: 'number' },
  { key: 'pre_screened_by_sdrs', label: "Pre-Screened by SDR's", type: 'number' },
  { key: 'needs_analysis', label: 'Needs Analysis', type: 'number' },
  { key: 'top_3_categories', label: 'Top 3 Categories', type: 'text' },
  { key: 'discharges', label: "D/C's", type: 'number' },
  { key: 'five_star_surveys', label: '5 STAR Surveys', type: 'number' },
] as const;

export type MetricKey = typeof SERVICE_DEV_METRICS[number]['key'];

export interface TerritoryData {
  [metricKey: string]: number | string;
}

export interface ServiceDevelopmentData {
  Red: TerritoryData;
  White: TerritoryData;
  Blue: TerritoryData;
}

const createEmptyTerritoryData = (): TerritoryData => {
  const data: TerritoryData = {};
  SERVICE_DEV_METRICS.forEach(metric => {
    data[metric.key] = metric.type === 'text' ? '' : 0;
  });
  return data;
};

const createEmptyData = (): ServiceDevelopmentData => ({
  Red: createEmptyTerritoryData(),
  White: createEmptyTerritoryData(),
  Blue: createEmptyTerritoryData(),
});

export function useServiceDevelopment(facilityId: string | null, unitId: string | null, date: Date) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [data, setData] = useState<ServiceDevelopmentData>(createEmptyData());

  const dateStr = format(date, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');

  // Fetch existing entries for the selected date and unit
  const { data: existingEntries, isLoading } = useQuery({
    queryKey: ['service-development', unitId, dateStr],
    queryFn: async () => {
      if (!unitId) return [];
      const { data, error } = await supabase
        .from('service_development_entries')
        .select('*')
        .eq('unit_id', unitId)
        .eq('date', dateStr);
      if (error) throw error;
      return data || [];
    },
    enabled: !!unitId,
  });

  // Load existing data into state when fetched
  useEffect(() => {
    if (existingEntries && existingEntries.length > 0) {
      const newData = createEmptyData();
      existingEntries.forEach((entry: any) => {
        const territory = entry.territory as Territory;
        const metricKey = entry.metric_name;
        if (newData[territory] && metricKey) {
          const metric = SERVICE_DEV_METRICS.find(m => m.key === metricKey);
          if (metric) {
            newData[territory][metricKey] = metric.type === 'text' 
              ? (entry.text_value || '') 
              : Number(entry.numeric_value) || 0;
          }
        }
      });
      setData(newData);
    } else {
      setData(createEmptyData());
    }
  }, [existingEntries]);

  const updateField = useCallback((territory: Territory, metricKey: string, value: number | string) => {
    setData(prev => ({
      ...prev,
      [territory]: {
        ...prev[territory],
        [metricKey]: value,
      },
    }));
  }, []);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!facilityId || !unitId || !user) throw new Error('Missing facility, unit, or user');

      // Build all entries (including those with no value for deletion)
      const entriesToUpsert: any[] = [];
      const entriesToDelete: { territory: string; metric_name: string }[] = [];

      TERRITORIES.forEach(territory => {
        SERVICE_DEV_METRICS.forEach(metric => {
          const value = data[territory][metric.key];
          const hasValue = metric.type === 'text' 
            ? (value as string).trim() !== ''
            : (value as number) !== 0;
          
          if (hasValue) {
            entriesToUpsert.push({
              facility_id: facilityId,
              unit_id: unitId,
              date: dateStr,
              territory,
              metric_name: metric.key,
              numeric_value: metric.type === 'number' ? value : 0,
              text_value: metric.type === 'text' ? value : null,
              submitted_by: user.id,
            });
          } else {
            entriesToDelete.push({ territory, metric_name: metric.key });
          }
        });
      });

      // Delete entries that no longer have values
      if (entriesToDelete.length > 0) {
        for (const entry of entriesToDelete) {
          const { error: deleteError } = await supabase
            .from('service_development_entries')
            .delete()
            .eq('unit_id', unitId)
            .eq('date', dateStr)
            .eq('territory', entry.territory)
            .eq('metric_name', entry.metric_name);
          if (deleteError) throw deleteError;
        }
      }

      // Upsert entries with values (handles both insert and update)
      if (entriesToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from('service_development_entries')
          .upsert(entriesToUpsert, { 
            onConflict: 'unit_id,date,territory,metric_name',
            ignoreDuplicates: false 
          });
        if (upsertError) throw upsertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-development', unitId, dateStr] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error saving Service Development data',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Copy yesterday's data
  const copyYesterdayMutation = useMutation({
    mutationFn: async () => {
      if (!unitId) throw new Error('No unit selected');
      
      const { data: yesterdayEntries, error } = await supabase
        .from('service_development_entries')
        .select('*')
        .eq('unit_id', unitId)
        .eq('date', yesterdayStr);
      
      if (error) throw error;
      
      if (!yesterdayEntries || yesterdayEntries.length === 0) {
        throw new Error('No data found for yesterday');
      }

      return yesterdayEntries;
    },
    onSuccess: (yesterdayEntries) => {
      const newData = createEmptyData();
      yesterdayEntries.forEach((entry: any) => {
        const territory = entry.territory as Territory;
        const metricKey = entry.metric_name;
        if (newData[territory] && metricKey) {
          const metric = SERVICE_DEV_METRICS.find(m => m.key === metricKey);
          if (metric) {
            newData[territory][metricKey] = metric.type === 'text' 
              ? (entry.text_value || '') 
              : Number(entry.numeric_value) || 0;
          }
        }
      });
      setData(newData);
      toast({ title: "Copied yesterday's Service Development data" });
    },
    onError: (error: any) => {
      toast({
        title: 'Could not copy yesterday data',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    data,
    updateField,
    isLoading,
    isSaving: saveMutation.isPending,
    isCopying: copyYesterdayMutation.isPending,
    save: saveMutation.mutateAsync,
    copyYesterday: copyYesterdayMutation.mutate,
    hasData: existingEntries && existingEntries.length > 0,
  };
}
