export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          resource_id: string | null
          resource_type: string | null
          user_email: string
          user_id: string
          user_role: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_email: string
          user_id: string
          user_role: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_email?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      actual_entries: {
        Row: {
          budget_year_id: string
          created_at: string
          date: string
          facility_id: string | null
          id: string
          notes: string | null
          row_id: string
          status: Database["public"]["Enums"]["entry_status"]
          submitted_at: string
          submitted_by: string
          unit_id: string
          updated_at: string
          value: number
        }
        Insert: {
          budget_year_id: string
          created_at?: string
          date: string
          facility_id?: string | null
          id?: string
          notes?: string | null
          row_id: string
          status?: Database["public"]["Enums"]["entry_status"]
          submitted_at?: string
          submitted_by: string
          unit_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          budget_year_id?: string
          created_at?: string
          date?: string
          facility_id?: string | null
          id?: string
          notes?: string | null
          row_id?: string
          status?: Database["public"]["Enums"]["entry_status"]
          submitted_at?: string
          submitted_by?: string
          unit_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "actual_entries_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "budget_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actual_entries_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actual_entries_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "budget_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actual_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_rows: {
        Row: {
          calculation_type: Database["public"]["Enums"]["calculation_type"]
          created_at: string
          data_type: Database["public"]["Enums"]["data_type"]
          display_order: number
          entry_mode: Database["public"]["Enums"]["entry_mode"]
          formula: string | null
          id: string
          is_active: boolean
          name: string
          row_key: string
          section_id: string
          updated_at: string
        }
        Insert: {
          calculation_type?: Database["public"]["Enums"]["calculation_type"]
          created_at?: string
          data_type?: Database["public"]["Enums"]["data_type"]
          display_order?: number
          entry_mode?: Database["public"]["Enums"]["entry_mode"]
          formula?: string | null
          id?: string
          is_active?: boolean
          name: string
          row_key: string
          section_id: string
          updated_at?: string
        }
        Update: {
          calculation_type?: Database["public"]["Enums"]["calculation_type"]
          created_at?: string
          data_type?: Database["public"]["Enums"]["data_type"]
          display_order?: number
          entry_mode?: Database["public"]["Enums"]["entry_mode"]
          formula?: string | null
          id?: string
          is_active?: boolean
          name?: string
          row_key?: string
          section_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_rows_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "budget_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      budget_template_rows: {
        Row: {
          created_at: string
          formula: string | null
          id: string
          row_key: string
          row_name: string
          row_type: string
          section: string
          sort_order: number
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          formula?: string | null
          id?: string
          row_key: string
          row_name: string
          row_type?: string
          section: string
          sort_order?: number
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          formula?: string | null
          id?: string
          row_key?: string
          row_name?: string
          row_type?: string
          section?: string
          sort_order?: number
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_template_rows_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "budget_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      budget_years: {
        Row: {
          created_at: string
          id: string
          is_locked: boolean
          locked_at: string | null
          locked_by_user_id: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_by_user_id?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_at?: string | null
          locked_by_user_id?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      budgets: {
        Row: {
          budget_year_id: string
          created_at: string
          created_by: string
          facility_id: string | null
          id: string
          month: number
          row_id: string
          unit_id: string
          updated_at: string
          value: number
        }
        Insert: {
          budget_year_id: string
          created_at?: string
          created_by: string
          facility_id?: string | null
          id?: string
          month: number
          row_id: string
          unit_id: string
          updated_at?: string
          value?: number
        }
        Update: {
          budget_year_id?: string
          created_at?: string
          created_by?: string
          facility_id?: string | null
          id?: string
          month?: number
          row_id?: string
          unit_id?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "budget_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "budget_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_operations: {
        Row: {
          abnormal_expenses_notes: string | null
          admin_chart_audits: number
          agency_lpns_cost: number
          agency_lpns_hours: number
          agency_mhts_cost: number
          agency_mhts_hours: number
          agency_rns_cost: number
          agency_rns_hours: number
          appeals_sent: number
          blue_territory_admits: number
          case_manager_cost: number
          case_manager_hours: number
          charity_indigent_pt_days: number
          charity_indigent_rev: number
          charts_requested: number
          clean_census: number
          clean_census_variance_why: string
          clinical_chart_audits: number
          comments_census: string | null
          comments_employee_risk: string | null
          comments_iop: string | null
          comments_quality_risk: string | null
          comments_service_development: string | null
          comments_staffing: string | null
          commercial_pt_days: number
          commercial_rev: number
          complaints: number
          created_at: string
          daily_pop: number
          date: string
          dc_against_medical_advice: number
          deficiency_reports_to_dept_head: boolean | null
          deficiency_reports_why: string | null
          dietary_over_budget: number
          discharges: number
          elmhs_pt_days: number | null
          elmhs_rev: number | null
          employees_hired: number
          employees_on_pip: number
          employees_termed: number
          employment_claims: number
          face_to_face_touches: number
          facility_id: string
          falls_with_injury: number
          falls_without_injury: number
          five_star_surveys: number
          grievances: number
          has_abnormal_expenses: boolean
          hmo_pt_days: number
          hmo_rev: number
          hospital_transfers_not_returned: number
          hospital_transfers_returned: number
          housekeepers_cost: number
          housekeepers_hours: number
          id: string
          incident_report_with_injury: number
          incident_report_without_injury: number
          initial_cert: number
          initial_cert_why: string | null
          initial_submitted_at: string | null
          inquiries: number
          inservices: number
          internal_dc_surveys_executed: number
          internal_dc_surveys_why: string | null
          iop_daily_attendance_total: number
          iop_daily_enrolled_total: number
          iop_daily_groups_billed: number
          iop_daily_meals_total: number
          lab_ppd_overage: number
          late_dc_summaries: number
          late_hp: number
          late_initial_treatment_plans: number
          late_psych_evals: number
          late_quality_why: string | null
          lpns_cost: number
          lpns_hours: number
          mcr_co_days: number
          mcr_co_days_rev: number
          mcr_full_days: number
          mcr_full_days_rev: number
          mcr_lifetime_days: number
          mcr_lifetime_days_rev: number
          medicaid_pt_days: number
          medicaid_rev: number
          medication_variance: number
          mhts_cost: number
          mhts_hours: number
          mtd_trailing_profit_loss: number
          mtp_signed_by_md: number
          needs_analysis: number
          nursing_chart_audits: number
          off_formulary_pharmacy_ppd: number
          one_to_ones_cost: number
          one_to_ones_hours: number
          pre_screened_by_sdrs: number
          private_pay_pt_days: number
          private_pay_rev: number
          projected_daily_expense: number
          projected_daily_revenue: number
          projected_profit_loss: number
          pto_cost: number
          pto_hours: number
          quality_chart_audits: number
          quality_touches: number
          rac_zpic_audits_open: number
          rate_charity_indigent: number
          rate_commercial: number
          rate_elmhs: number | null
          rate_hmo: number
          rate_mcr_co_days: number
          rate_mcr_full_days: number
          rate_mcr_lifetime_days: number
          rate_medicaid: number
          rate_private_pay: number
          recert: number
          red_territory_admits: number
          referrals: number
          restraints: number
          rns_cost: number
          rns_hours: number
          rtbh_outside_budget_submitted: number
          safety_rounds: number
          seclusions: number
          status: string
          submitted_by: string
          supplies_orders_placed: number
          top_3_categories: string | null
          total_deposits: number
          total_payroll: number
          training_non_pro_cost: number
          training_non_pro_hours: number
          unit_id: string
          updated_at: string
          white_territory_admits: number
        }
        Insert: {
          abnormal_expenses_notes?: string | null
          admin_chart_audits?: number
          agency_lpns_cost?: number
          agency_lpns_hours?: number
          agency_mhts_cost?: number
          agency_mhts_hours?: number
          agency_rns_cost?: number
          agency_rns_hours?: number
          appeals_sent?: number
          blue_territory_admits?: number
          case_manager_cost?: number
          case_manager_hours?: number
          charity_indigent_pt_days?: number
          charity_indigent_rev?: number
          charts_requested?: number
          clean_census?: number
          clean_census_variance_why?: string
          clinical_chart_audits?: number
          comments_census?: string | null
          comments_employee_risk?: string | null
          comments_iop?: string | null
          comments_quality_risk?: string | null
          comments_service_development?: string | null
          comments_staffing?: string | null
          commercial_pt_days?: number
          commercial_rev?: number
          complaints?: number
          created_at?: string
          daily_pop?: number
          date: string
          dc_against_medical_advice?: number
          deficiency_reports_to_dept_head?: boolean | null
          deficiency_reports_why?: string | null
          dietary_over_budget?: number
          discharges?: number
          elmhs_pt_days?: number | null
          elmhs_rev?: number | null
          employees_hired?: number
          employees_on_pip?: number
          employees_termed?: number
          employment_claims?: number
          face_to_face_touches?: number
          facility_id: string
          falls_with_injury?: number
          falls_without_injury?: number
          five_star_surveys?: number
          grievances?: number
          has_abnormal_expenses?: boolean
          hmo_pt_days?: number
          hmo_rev?: number
          hospital_transfers_not_returned?: number
          hospital_transfers_returned?: number
          housekeepers_cost?: number
          housekeepers_hours?: number
          id?: string
          incident_report_with_injury?: number
          incident_report_without_injury?: number
          initial_cert?: number
          initial_cert_why?: string | null
          initial_submitted_at?: string | null
          inquiries?: number
          inservices?: number
          internal_dc_surveys_executed?: number
          internal_dc_surveys_why?: string | null
          iop_daily_attendance_total?: number
          iop_daily_enrolled_total?: number
          iop_daily_groups_billed?: number
          iop_daily_meals_total?: number
          lab_ppd_overage?: number
          late_dc_summaries?: number
          late_hp?: number
          late_initial_treatment_plans?: number
          late_psych_evals?: number
          late_quality_why?: string | null
          lpns_cost?: number
          lpns_hours?: number
          mcr_co_days?: number
          mcr_co_days_rev?: number
          mcr_full_days?: number
          mcr_full_days_rev?: number
          mcr_lifetime_days?: number
          mcr_lifetime_days_rev?: number
          medicaid_pt_days?: number
          medicaid_rev?: number
          medication_variance?: number
          mhts_cost?: number
          mhts_hours?: number
          mtd_trailing_profit_loss?: number
          mtp_signed_by_md?: number
          needs_analysis?: number
          nursing_chart_audits?: number
          off_formulary_pharmacy_ppd?: number
          one_to_ones_cost?: number
          one_to_ones_hours?: number
          pre_screened_by_sdrs?: number
          private_pay_pt_days?: number
          private_pay_rev?: number
          projected_daily_expense?: number
          projected_daily_revenue?: number
          projected_profit_loss?: number
          pto_cost?: number
          pto_hours?: number
          quality_chart_audits?: number
          quality_touches?: number
          rac_zpic_audits_open?: number
          rate_charity_indigent?: number
          rate_commercial?: number
          rate_elmhs?: number | null
          rate_hmo?: number
          rate_mcr_co_days?: number
          rate_mcr_full_days?: number
          rate_mcr_lifetime_days?: number
          rate_medicaid?: number
          rate_private_pay?: number
          recert?: number
          red_territory_admits?: number
          referrals?: number
          restraints?: number
          rns_cost?: number
          rns_hours?: number
          rtbh_outside_budget_submitted?: number
          safety_rounds?: number
          seclusions?: number
          status?: string
          submitted_by: string
          supplies_orders_placed?: number
          top_3_categories?: string | null
          total_deposits?: number
          total_payroll?: number
          training_non_pro_cost?: number
          training_non_pro_hours?: number
          unit_id: string
          updated_at?: string
          white_territory_admits?: number
        }
        Update: {
          abnormal_expenses_notes?: string | null
          admin_chart_audits?: number
          agency_lpns_cost?: number
          agency_lpns_hours?: number
          agency_mhts_cost?: number
          agency_mhts_hours?: number
          agency_rns_cost?: number
          agency_rns_hours?: number
          appeals_sent?: number
          blue_territory_admits?: number
          case_manager_cost?: number
          case_manager_hours?: number
          charity_indigent_pt_days?: number
          charity_indigent_rev?: number
          charts_requested?: number
          clean_census?: number
          clean_census_variance_why?: string
          clinical_chart_audits?: number
          comments_census?: string | null
          comments_employee_risk?: string | null
          comments_iop?: string | null
          comments_quality_risk?: string | null
          comments_service_development?: string | null
          comments_staffing?: string | null
          commercial_pt_days?: number
          commercial_rev?: number
          complaints?: number
          created_at?: string
          daily_pop?: number
          date?: string
          dc_against_medical_advice?: number
          deficiency_reports_to_dept_head?: boolean | null
          deficiency_reports_why?: string | null
          dietary_over_budget?: number
          discharges?: number
          elmhs_pt_days?: number | null
          elmhs_rev?: number | null
          employees_hired?: number
          employees_on_pip?: number
          employees_termed?: number
          employment_claims?: number
          face_to_face_touches?: number
          facility_id?: string
          falls_with_injury?: number
          falls_without_injury?: number
          five_star_surveys?: number
          grievances?: number
          has_abnormal_expenses?: boolean
          hmo_pt_days?: number
          hmo_rev?: number
          hospital_transfers_not_returned?: number
          hospital_transfers_returned?: number
          housekeepers_cost?: number
          housekeepers_hours?: number
          id?: string
          incident_report_with_injury?: number
          incident_report_without_injury?: number
          initial_cert?: number
          initial_cert_why?: string | null
          initial_submitted_at?: string | null
          inquiries?: number
          inservices?: number
          internal_dc_surveys_executed?: number
          internal_dc_surveys_why?: string | null
          iop_daily_attendance_total?: number
          iop_daily_enrolled_total?: number
          iop_daily_groups_billed?: number
          iop_daily_meals_total?: number
          lab_ppd_overage?: number
          late_dc_summaries?: number
          late_hp?: number
          late_initial_treatment_plans?: number
          late_psych_evals?: number
          late_quality_why?: string | null
          lpns_cost?: number
          lpns_hours?: number
          mcr_co_days?: number
          mcr_co_days_rev?: number
          mcr_full_days?: number
          mcr_full_days_rev?: number
          mcr_lifetime_days?: number
          mcr_lifetime_days_rev?: number
          medicaid_pt_days?: number
          medicaid_rev?: number
          medication_variance?: number
          mhts_cost?: number
          mhts_hours?: number
          mtd_trailing_profit_loss?: number
          mtp_signed_by_md?: number
          needs_analysis?: number
          nursing_chart_audits?: number
          off_formulary_pharmacy_ppd?: number
          one_to_ones_cost?: number
          one_to_ones_hours?: number
          pre_screened_by_sdrs?: number
          private_pay_pt_days?: number
          private_pay_rev?: number
          projected_daily_expense?: number
          projected_daily_revenue?: number
          projected_profit_loss?: number
          pto_cost?: number
          pto_hours?: number
          quality_chart_audits?: number
          quality_touches?: number
          rac_zpic_audits_open?: number
          rate_charity_indigent?: number
          rate_commercial?: number
          rate_elmhs?: number | null
          rate_hmo?: number
          rate_mcr_co_days?: number
          rate_mcr_full_days?: number
          rate_mcr_lifetime_days?: number
          rate_medicaid?: number
          rate_private_pay?: number
          recert?: number
          red_territory_admits?: number
          referrals?: number
          restraints?: number
          rns_cost?: number
          rns_hours?: number
          rtbh_outside_budget_submitted?: number
          safety_rounds?: number
          seclusions?: number
          status?: string
          submitted_by?: string
          supplies_orders_placed?: number
          top_3_categories?: string | null
          total_deposits?: number
          total_payroll?: number
          training_non_pro_cost?: number
          training_non_pro_hours?: number
          unit_id?: string
          updated_at?: string
          white_territory_admits?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_operations_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_operations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      facilities: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      iop_patients: {
        Row: {
          admit_date: string
          created_at: string
          created_by: string
          discharge_date: string | null
          entry_date: string
          facility_id: string
          first_name: string
          groups_attended: number
          id: string
          last_name: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          admit_date: string
          created_at?: string
          created_by: string
          discharge_date?: string | null
          entry_date?: string
          facility_id: string
          first_name: string
          groups_attended?: number
          id?: string
          last_name: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          admit_date?: string
          created_at?: string
          created_by?: string
          discharge_date?: string | null
          entry_date?: string
          facility_id?: string
          first_name?: string
          groups_attended?: number
          id?: string
          last_name?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iop_patients_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iop_patients_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      program_ranking_daily_actuals: {
        Row: {
          actual_value: number
          created_at: string
          date: string
          facility_id: string
          id: string
          source: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          actual_value?: number
          created_at?: string
          date: string
          facility_id: string
          id?: string
          source: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          actual_value?: number
          created_at?: string
          date?: string
          facility_id?: string
          id?: string
          source?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_ranking_daily_actuals_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_ranking_daily_actuals_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      service_development_entries: {
        Row: {
          created_at: string
          date: string
          facility_id: string
          id: string
          metric_name: string
          numeric_value: number
          submitted_by: string
          territory: string
          text_value: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          facility_id: string
          id?: string
          metric_name: string
          numeric_value?: number
          submitted_by: string
          territory: string
          text_value?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          facility_id?: string
          id?: string
          metric_name?: string
          numeric_value?: number
          submitted_by?: string
          territory?: string
          text_value?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_development_entries_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_development_entries_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_budget_config: {
        Row: {
          budgeted_daily_costs: Json
          created_at: string
          id: string
          rate_charity_indigent: number
          rate_commercial: number
          rate_elmhs: number | null
          rate_hmo: number
          rate_mcr_co_days: number
          rate_mcr_full_days: number
          rate_mcr_lifetime_days: number
          rate_medicaid: number
          rate_per_group: number
          rate_private_pay: number
          unit_id: string
          updated_at: string
        }
        Insert: {
          budgeted_daily_costs?: Json
          created_at?: string
          id?: string
          rate_charity_indigent?: number
          rate_commercial?: number
          rate_elmhs?: number | null
          rate_hmo?: number
          rate_mcr_co_days?: number
          rate_mcr_full_days?: number
          rate_mcr_lifetime_days?: number
          rate_medicaid?: number
          rate_per_group?: number
          rate_private_pay?: number
          unit_id: string
          updated_at?: string
        }
        Update: {
          budgeted_daily_costs?: Json
          created_at?: string
          id?: string
          rate_charity_indigent?: number
          rate_commercial?: number
          rate_elmhs?: number | null
          rate_hmo?: number
          rate_mcr_co_days?: number
          rate_mcr_full_days?: number
          rate_mcr_lifetime_days?: number
          rate_medicaid?: number
          rate_per_group?: number
          rate_private_pay?: number
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_budget_config_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: true
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          budget_template_id: string | null
          created_at: string
          facility_id: string
          id: string
          is_active: boolean
          name: string
          operating_days: number[]
          unit_type: string
          updated_at: string
        }
        Insert: {
          budget_template_id?: string | null
          created_at?: string
          facility_id: string
          id?: string
          is_active?: boolean
          name: string
          operating_days?: number[]
          unit_type?: string
          updated_at?: string
        }
        Update: {
          budget_template_id?: string | null
          created_at?: string
          facility_id?: string
          id?: string
          is_active?: boolean
          name?: string
          operating_days?: number[]
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_budget_template_id_fkey"
            columns: ["budget_template_id"]
            isOneToOne: false
            referencedRelation: "budget_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access_settings: {
        Row: {
          can_view_all_facilities: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_view_all_facilities?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_view_all_facilities?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_facility_assignments: {
        Row: {
          created_at: string
          facility_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          facility_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          facility_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_facility_assignments_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_can_view_facility: {
        Args: { _facility_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "editor"
        | "viewer"
        | "nursing"
        | "service_development"
        | "program_administrator"
        | "adon"
        | "don"
        | "him"
        | "sdd"
        | "human_resources"
      calculation_type: "manual" | "calculated"
      data_type: "currency" | "integer" | "percent" | "decimal"
      entry_mode: "budget_only" | "actual_only" | "both"
      entry_status: "draft" | "submitted"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "editor",
        "viewer",
        "nursing",
        "service_development",
        "program_administrator",
        "adon",
        "don",
        "him",
        "sdd",
        "human_resources",
      ],
      calculation_type: ["manual", "calculated"],
      data_type: ["currency", "integer", "percent", "decimal"],
      entry_mode: ["budget_only", "actual_only", "both"],
      entry_status: ["draft", "submitted"],
    },
  },
} as const
