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
      combo_ticket_museums: {
        Row: {
          created_at: string | null
          credits: number
          id: string
          museum_id: string
          ticket_type_id: string
        }
        Insert: {
          created_at?: string | null
          credits?: number
          id?: string
          museum_id: string
          ticket_type_id: string
        }
        Update: {
          created_at?: string | null
          credits?: number
          id?: string
          museum_id?: string
          ticket_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_ticket_museums_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_ticket_museums_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      museum_group_members: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          museum_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          museum_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          museum_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "museum_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "museum_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "museum_group_members_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
        ]
      }
      museum_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      museum_ticket_prices: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          museum_id: string
          price: number
          ticket_type_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          museum_id: string
          price?: number
          ticket_type_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          museum_id?: string
          price?: number
          ticket_type_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "museum_ticket_prices_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "museum_ticket_prices_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      museums: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assigned_museum_id: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          updated_at: string | null
          username: string
        }
        Insert: {
          assigned_museum_id?: string | null
          created_at?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          updated_at?: string | null
          username: string
        }
        Update: {
          assigned_museum_id?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_assigned_museum_id_fkey"
            columns: ["assigned_museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
        ]
      }
      session_templates: {
        Row: {
          capacity: number
          created_at: string | null
          end_time: string
          id: string
          is_active: boolean | null
          museum_id: string
          name: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          museum_id: string
          name: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          museum_id?: string
          name?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_templates_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          capacity: number
          created_at: string | null
          end_time: string
          id: string
          is_active: boolean | null
          museum_id: string
          session_date: string
          sold_count: number
          start_time: string
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          museum_id: string
          session_date: string
          sold_count?: number
          start_time: string
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          museum_id?: string
          session_date?: string
          sold_count?: number
          start_time?: string
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "session_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_rotations: {
        Row: {
          created_at: string | null
          id: string
          is_manual_override: boolean | null
          museum_id: string
          rotation_month: string
          rotation_order: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_manual_override?: boolean | null
          museum_id: string
          rotation_month: string
          rotation_order?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_manual_override?: boolean | null
          museum_id?: string
          rotation_month?: string
          rotation_order?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_rotations_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_rotations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_types: {
        Row: {
          color: string
          created_at: string | null
          credits: number
          icon: string
          id: string
          is_active: boolean | null
          is_combo: boolean
          name: string
          price: number
          type_key: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          credits?: number
          icon?: string
          id?: string
          is_active?: boolean | null
          is_combo?: boolean
          name: string
          price?: number
          type_key: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          credits?: number
          icon?: string
          id?: string
          is_active?: boolean | null
          is_combo?: boolean
          name?: string
          price?: number
          type_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ticket_usage: {
        Row: {
          id: string
          museum_id: string
          ticket_id: string
          used_at: string
          used_by: string | null
          used_credits: number
        }
        Insert: {
          id?: string
          museum_id: string
          ticket_id: string
          used_at?: string
          used_by?: string | null
          used_credits?: number
        }
        Update: {
          id?: string
          museum_id?: string
          ticket_id?: string
          used_at?: string
          used_by?: string | null
          used_credits?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_usage_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_usage_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          created_at: string | null
          id: string
          is_used: boolean | null
          museum_id: string
          price: number
          qr_code: string
          remaining_credits: number
          session_id: string | null
          sold_by: string
          ticket_type_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          museum_id: string
          price: number
          qr_code: string
          remaining_credits?: number
          session_id?: string | null
          sold_by: string
          ticket_type_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_used?: boolean | null
          museum_id?: string
          price?: number
          qr_code?: string
          remaining_credits?: number
          session_id?: string | null
          sold_by?: string
          ticket_type_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_ticket_type_id_fkey"
            columns: ["ticket_type_id"]
            isOneToOne: false
            referencedRelation: "ticket_types"
            referencedColumns: ["id"]
          },
        ]
      }
      user_museum_groups: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_museum_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "museum_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_museum_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_museums: {
        Row: {
          created_at: string | null
          id: string
          museum_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          museum_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          museum_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_museums_museum_id_fkey"
            columns: ["museum_id"]
            isOneToOne: false
            referencedRelation: "museums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_museums_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          id: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Insert: {
          id?: string
          permission: Database["public"]["Enums"]["app_permission"]
          user_id: string
        }
        Update: {
          id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_permission:
        | "sell_tickets"
        | "view_reports"
        | "manage_staff"
        | "manage_museums"
        | "manage_sessions"
        | "manage_ticket_types"
        | "manage_settings"
        | "delete_tickets"
      app_role: "admin" | "cashier"
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
      app_permission: [
        "sell_tickets",
        "view_reports",
        "manage_staff",
        "manage_museums",
        "manage_sessions",
        "manage_ticket_types",
        "manage_settings",
        "delete_tickets",
      ],
      app_role: ["admin", "cashier"],
    },
  },
} as const
