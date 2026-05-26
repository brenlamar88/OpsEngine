import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BudgetedDailyCosts {
  [census: string]: number;
}

export interface UnitBudgetConfig {
  id: string;
  unitId: string;
  rateMcrFullDays: number;
  rateMcrCoDays: number;
  rateMcrLifetimeDays: number;
  rateHmo: number;
  rateMedicaid: number;
  rateCommercial: number;
  ratePrivatePay: number;
  rateCharityIndigent: number;
  rateElmhs: number;
  budgetedDailyCosts: BudgetedDailyCosts;
  ratePerGroup: number;
}

const defaultBudgetedDailyCosts: BudgetedDailyCosts = {
  "0": 9276.45, "1": 9212.32, "2": 9148.19, "3": 9084.06, "4": 9019.93,
  "5": 8955.80, "6": 8891.67, "7": 8827.54, "8": 8763.41, "9": 8699.28,
  "10": 8635.15, "11": 8571.02, "12": 8506.89, "13": 8442.76, "14": 8378.63,
  "15": 8314.50, "16": 8250.37, "17": 8186.24, "18": 8122.11, "19": 8057.98,
  "20": 7993.85, "21": 7929.72, "22": 7865.59, "23": 7801.46, "24": 7737.33,
  "25": 7673.20, "26": 7609.07, "27": 7544.94, "28": 7480.81, "29": 7416.68,
  "30": 7352.55, "31": 7288.42, "32": 7224.29, "33": 7160.16, "34": 7096.03,
  "35": 7031.90
};

const defaultConfig: Omit<UnitBudgetConfig, 'id' | 'unitId'> = {
  rateMcrFullDays: 955,
  rateMcrCoDays: 536,
  rateMcrLifetimeDays: 117,
  rateHmo: 900,
  rateMedicaid: 737,
  rateCommercial: 800,
  ratePrivatePay: 800,
  rateCharityIndigent: 0,
  rateElmhs: 0,
  budgetedDailyCosts: defaultBudgetedDailyCosts,
  ratePerGroup: 0,
};

function fromDbRecord(record: any): UnitBudgetConfig {
  return {
    id: record.id,
    unitId: record.unit_id,
    rateMcrFullDays: Number(record.rate_mcr_full_days),
    rateMcrCoDays: Number(record.rate_mcr_co_days),
    rateMcrLifetimeDays: Number(record.rate_mcr_lifetime_days),
    rateHmo: Number(record.rate_hmo),
    rateMedicaid: Number(record.rate_medicaid),
    rateCommercial: Number(record.rate_commercial),
    ratePrivatePay: Number(record.rate_private_pay),
    rateCharityIndigent: Number(record.rate_charity_indigent),
    rateElmhs: Number(record.rate_elmhs) || 0,
    budgetedDailyCosts: record.budgeted_daily_costs as BudgetedDailyCosts,
    ratePerGroup: Number(record.rate_per_group) || 0,
  };
}

function toDbRecord(config: Partial<UnitBudgetConfig>, unitId: string) {
  return {
    unit_id: unitId,
    rate_mcr_full_days: config.rateMcrFullDays,
    rate_mcr_co_days: config.rateMcrCoDays,
    rate_mcr_lifetime_days: config.rateMcrLifetimeDays,
    rate_hmo: config.rateHmo,
    rate_medicaid: config.rateMedicaid,
    rate_commercial: config.rateCommercial,
    rate_private_pay: config.ratePrivatePay,
    rate_charity_indigent: config.rateCharityIndigent,
    rate_elmhs: config.rateElmhs,
    budgeted_daily_costs: config.budgetedDailyCosts,
    rate_per_group: config.ratePerGroup,
  };
}

export function useUnitBudgetConfig(unitId: string | null) {
  const queryClient = useQueryClient();
  const [localConfig, setLocalConfig] = useState<UnitBudgetConfig | null>(null);

  const { data: dbConfig, isLoading } = useQuery({
    queryKey: ['unit-budget-config', unitId],
    queryFn: async () => {
      if (!unitId) return null;

      const { data, error } = await supabase
        .from('unit_budget_config')
        .select('*')
        .eq('unit_id', unitId)
        .maybeSingle();

      if (error) throw error;
      return data ? fromDbRecord(data) : null;
    },
    enabled: !!unitId,
  });

  // Initialize local config when db data loads or when unit changes
  useEffect(() => {
    if (dbConfig) {
      setLocalConfig(dbConfig);
    } else if (unitId && !isLoading) {
      // No config exists yet, use defaults
      setLocalConfig({
        id: '',
        unitId,
        ...defaultConfig,
      });
    }
  }, [dbConfig, unitId, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async (config: Partial<UnitBudgetConfig>) => {
      if (!unitId) throw new Error('No unit selected');

      const dbRecord = toDbRecord(config, unitId);

      // Check if config exists
      const { data: existing } = await supabase
        .from('unit_budget_config')
        .select('id')
        .eq('unit_id', unitId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('unit_budget_config')
          .update(dbRecord)
          .eq('unit_id', unitId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('unit_budget_config')
          .insert(dbRecord);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-budget-config', unitId] });
      toast.success('Budget configuration saved');
    },
    onError: (error) => {
      console.error('Failed to save budget config:', error);
      toast.error('Failed to save budget configuration');
    },
  });

  const updateConfig = (updates: Partial<UnitBudgetConfig>) => {
    if (!localConfig) return;
    setLocalConfig({ ...localConfig, ...updates });
  };

  const updateBudgetedDailyCost = (census: number, value: number) => {
    if (!localConfig) return;
    setLocalConfig({
      ...localConfig,
      budgetedDailyCosts: {
        ...localConfig.budgetedDailyCosts,
        [census.toString()]: value,
      },
    });
  };

  const saveConfig = () => {
    if (!localConfig) return;
    saveMutation.mutate(localConfig);
  };

  // Get projected expense for a given census
  const getProjectedExpense = (census: number): number => {
    if (!localConfig) return 0;
    const key = Math.min(Math.max(0, Math.floor(census)), 35).toString();
    return localConfig.budgetedDailyCosts[key] ?? 0;
  };

  return {
    config: localConfig,
    isLoading,
    isSaving: saveMutation.isPending,
    updateConfig,
    updateBudgetedDailyCost,
    saveConfig,
    getProjectedExpense,
    defaultConfig,
  };
}
