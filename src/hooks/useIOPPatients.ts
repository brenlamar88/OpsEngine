import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface IOPPatient {
  id: string;
  unitId: string;
  facilityId: string;
  firstName: string;
  lastName: string;
  admitDate: string;
  dischargeDate: string | null;
  groupsAttended: number;
  entryDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface IOPPatientInsert {
  firstName: string;
  lastName: string;
  admitDate: string;
  dischargeDate?: string | null;
  groupsAttended: number;
  entryDate: string;
}

const fromDbRecord = (record: any): IOPPatient => ({
  id: record.id,
  unitId: record.unit_id,
  facilityId: record.facility_id,
  firstName: record.first_name,
  lastName: record.last_name,
  admitDate: record.admit_date,
  dischargeDate: record.discharge_date,
  groupsAttended: record.groups_attended,
  entryDate: record.entry_date,
  createdBy: record.created_by,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

export const useIOPPatients = (unitId: string | null, facilityId: string | null, entryDate: Date) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const formattedDate = entryDate.toISOString().split('T')[0];

  // Calculate yesterday's date
  const yesterday = new Date(entryDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const formattedYesterday = yesterday.toISOString().split('T')[0];

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["iop-patients", unitId, facilityId, formattedDate],
    queryFn: async () => {
      if (!unitId || !facilityId) return [];

      const { data, error } = await supabase
        .from("iop_patients")
        .select("*")
        .eq("unit_id", unitId)
        .eq("facility_id", facilityId)
        .eq("entry_date", formattedDate)
        .order("admit_date", { ascending: false });

      if (error) throw error;
      return data.map(fromDbRecord);
    },
    enabled: !!unitId && !!facilityId,
  });

  // Fetch yesterday's patients for copy functionality
  const { data: yesterdayPatients = [] } = useQuery({
    queryKey: ["iop-patients", unitId, facilityId, formattedYesterday],
    queryFn: async () => {
      if (!unitId || !facilityId) return [];

      const { data, error } = await supabase
        .from("iop_patients")
        .select("*")
        .eq("unit_id", unitId)
        .eq("facility_id", facilityId)
        .eq("entry_date", formattedYesterday)
        .order("admit_date", { ascending: false });

      if (error) throw error;
      return data.map(fromDbRecord);
    },
    enabled: !!unitId && !!facilityId,
  });

  const addPatient = useMutation({
    mutationFn: async (patient: IOPPatientInsert) => {
      if (!unitId || !facilityId) throw new Error("Unit and facility required");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("iop_patients")
        .insert({
          unit_id: unitId,
          facility_id: facilityId,
          first_name: patient.firstName.substring(0, 3),
          last_name: patient.lastName.substring(0, 1),
          admit_date: patient.admitDate,
          discharge_date: patient.dischargeDate || null,
          groups_attended: patient.groupsAttended,
          entry_date: patient.entryDate,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return fromDbRecord(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iop-patients", unitId, facilityId, formattedDate] });
      toast({ title: "Patient added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error adding patient", description: error.message, variant: "destructive" });
    },
  });

  const removePatient = useMutation({
    mutationFn: async (patientId: string) => {
      const { error } = await supabase
        .from("iop_patients")
        .delete()
        .eq("id", patientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iop-patients", unitId, facilityId, formattedDate] });
      toast({ title: "Patient removed successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error removing patient", description: error.message, variant: "destructive" });
    },
  });

  const updatePatient = useMutation({
    mutationFn: async ({ patientId, updates }: { patientId: string; updates: Partial<IOPPatientInsert> }) => {
      const updateData: any = {};
      if (updates.firstName !== undefined) updateData.first_name = updates.firstName.substring(0, 3);
      if (updates.lastName !== undefined) updateData.last_name = updates.lastName.substring(0, 1);
      if (updates.admitDate !== undefined) updateData.admit_date = updates.admitDate;
      if (updates.dischargeDate !== undefined) updateData.discharge_date = updates.dischargeDate || null;
      if (updates.groupsAttended !== undefined) updateData.groups_attended = updates.groupsAttended;

      const { error } = await supabase
        .from("iop_patients")
        .update(updateData)
        .eq("id", patientId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iop-patients", unitId, facilityId, formattedDate] });
      toast({ title: "Patient updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating patient", description: error.message, variant: "destructive" });
    },
  });

  const copyFromYesterday = useMutation({
    mutationFn: async () => {
      if (!unitId || !facilityId) throw new Error("Unit and facility required");
      if (yesterdayPatients.length === 0) throw new Error("No patients from yesterday to copy");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Insert all yesterday's patients with today's entry_date
      const patientsToInsert = yesterdayPatients.map((p) => ({
        unit_id: unitId,
        facility_id: facilityId,
        first_name: p.firstName,
        last_name: p.lastName,
        admit_date: p.admitDate,
        discharge_date: p.dischargeDate || null,
        groups_attended: p.groupsAttended,
        entry_date: formattedDate,
        created_by: user.id,
      }));

      const { error } = await supabase
        .from("iop_patients")
        .insert(patientsToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iop-patients", unitId, facilityId, formattedDate] });
      toast({ title: "Copied patients from yesterday" });
    },
    onError: (error: any) => {
      toast({ title: "Error copying patients", description: error.message, variant: "destructive" });
    },
  });

  return {
    patients,
    isLoading,
    addPatient,
    removePatient,
    updatePatient,
    copyFromYesterday,
    yesterdayPatients,
  };
};
