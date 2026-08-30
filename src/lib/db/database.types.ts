export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      areas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          sort_order: number
          status: Database["public"]["Enums"]["area_status"]
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["area_status"]
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["area_status"]
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      commitment_events: {
        Row: {
          commitment_id: string
          created_at: string
          details: Json
          event_on: string
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["commitment_event_kind"]
          outcome: Database["public"]["Enums"]["commitment_outcome"] | null
          ritual_session_id: string | null
          title_snapshot: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          commitment_id: string
          created_at?: string
          details?: Json
          event_on: string
          id?: string
          idempotency_key?: string
          kind: Database["public"]["Enums"]["commitment_event_kind"]
          outcome?: Database["public"]["Enums"]["commitment_outcome"] | null
          ritual_session_id?: string | null
          title_snapshot: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          commitment_id?: string
          created_at?: string
          details?: Json
          event_on?: string
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["commitment_event_kind"]
          outcome?: Database["public"]["Enums"]["commitment_outcome"] | null
          ritual_session_id?: string | null
          title_snapshot?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commitment_events_commitment_fkey"
            columns: ["user_id", "commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "commitment_events_session_fkey"
            columns: ["user_id", "ritual_session_id"]
            isOneToOne: false
            referencedRelation: "ritual_sessions"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      commitments: {
        Row: {
          completed_at: string | null
          created_at: string
          details: string | null
          due_on: string | null
          goal_id: string | null
          id: string
          state: Database["public"]["Enums"]["commitment_state"]
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          details?: string | null
          due_on?: string | null
          goal_id?: string | null
          id?: string
          state?: Database["public"]["Enums"]["commitment_state"]
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          details?: string | null
          due_on?: string | null
          goal_id?: string | null
          id?: string
          state?: Database["public"]["Enums"]["commitment_state"]
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "commitments_goal_fkey"
            columns: ["user_id", "goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      daily_entries: {
        Row: {
          blocker_text: string | null
          blocker_type: Database["public"]["Enums"]["blocker_type"] | null
          buried_win: string | null
          created_at: string
          id: string
          is_sensitive: boolean
          moved_text: string | null
          next_commitment_id: string | null
          optional_context: string | null
          previous_commitment_id: string | null
          previous_commitment_outcome:
            | Database["public"]["Enums"]["commitment_outcome"]
            | null
          ritual_session_id: string
          session_kind: Database["public"]["Enums"]["ritual_kind"]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          blocker_text?: string | null
          blocker_type?: Database["public"]["Enums"]["blocker_type"] | null
          buried_win?: string | null
          created_at?: string
          id?: string
          is_sensitive?: boolean
          moved_text?: string | null
          next_commitment_id?: string | null
          optional_context?: string | null
          previous_commitment_id?: string | null
          previous_commitment_outcome?:
            | Database["public"]["Enums"]["commitment_outcome"]
            | null
          ritual_session_id: string
          session_kind?: Database["public"]["Enums"]["ritual_kind"]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          blocker_text?: string | null
          blocker_type?: Database["public"]["Enums"]["blocker_type"] | null
          buried_win?: string | null
          created_at?: string
          id?: string
          is_sensitive?: boolean
          moved_text?: string | null
          next_commitment_id?: string | null
          optional_context?: string | null
          previous_commitment_id?: string | null
          previous_commitment_outcome?:
            | Database["public"]["Enums"]["commitment_outcome"]
            | null
          ritual_session_id?: string
          session_kind?: Database["public"]["Enums"]["ritual_kind"]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_entries_next_commitment_fkey"
            columns: ["user_id", "next_commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "daily_entries_previous_commitment_fkey"
            columns: ["user_id", "previous_commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "daily_entries_session_fkey"
            columns: ["user_id", "ritual_session_id", "session_kind"]
            isOneToOne: true
            referencedRelation: "ritual_sessions"
            referencedColumns: ["user_id", "id", "kind"]
          },
        ]
      }
      goals: {
        Row: {
          area_id: string | null
          created_at: string
          description: string | null
          id: string
          priority: number
          status: Database["public"]["Enums"]["goal_status"]
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          area_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: number
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_area_fkey"
            columns: ["user_id", "area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      key_dates: {
        Row: {
          area_id: string | null
          completed_at: string | null
          created_at: string
          due_on: string
          goal_id: string | null
          id: string
          kind: Database["public"]["Enums"]["key_date_kind"]
          notes: string | null
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          area_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_on: string
          goal_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["key_date_kind"]
          notes?: string | null
          title: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          area_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_on?: string
          goal_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["key_date_kind"]
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "key_dates_area_fkey"
            columns: ["user_id", "area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "key_dates_goal_fkey"
            columns: ["user_id", "goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      notification_events: {
        Row: {
          attempt_count: number
          claimed_at: string | null
          created_at: string
          error_code: string | null
          failed_at: string | null
          id: string
          provider_message_id: string | null
          reminder_rule_id: string
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          attempt_count?: number
          claimed_at?: string | null
          created_at?: string
          error_code?: string | null
          failed_at?: string | null
          id?: string
          provider_message_id?: string | null
          reminder_rule_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          attempt_count?: number
          claimed_at?: string | null
          created_at?: string
          error_code?: string | null
          failed_at?: string | null
          id?: string
          provider_message_id?: string | null
          reminder_rule_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_rule_fkey"
            columns: ["user_id", "reminder_rule_id"]
            isOneToOne: false
            referencedRelation: "reminder_rules"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          ritual_version: string
          timezone: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          ritual_version?: string
          timezone?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          ritual_version?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      reminder_rules: {
        Row: {
          cadence: Database["public"]["Enums"]["reminder_cadence"]
          commitment_id: string | null
          created_at: string
          enabled: boolean
          id: string
          local_time: string
          next_run_at: string | null
          ritual_kind: Database["public"]["Enums"]["ritual_kind"] | null
          ritual_session_id: string | null
          timezone: string
          updated_at: string
          user_id: string
          version: number
          weekday: number | null
        }
        Insert: {
          cadence: Database["public"]["Enums"]["reminder_cadence"]
          commitment_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          local_time: string
          next_run_at?: string | null
          ritual_kind?: Database["public"]["Enums"]["ritual_kind"] | null
          ritual_session_id?: string | null
          timezone: string
          updated_at?: string
          user_id: string
          version?: number
          weekday?: number | null
        }
        Update: {
          cadence?: Database["public"]["Enums"]["reminder_cadence"]
          commitment_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          local_time?: string
          next_run_at?: string | null
          ritual_kind?: Database["public"]["Enums"]["ritual_kind"] | null
          ritual_session_id?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          version?: number
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_rules_commitment_fkey"
            columns: ["user_id", "commitment_id"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "reminder_rules_session_fkey"
            columns: ["user_id", "ritual_session_id", "ritual_kind"]
            isOneToOne: false
            referencedRelation: "ritual_sessions"
            referencedColumns: ["user_id", "id", "kind"]
          },
        ]
      }
      ritual_sessions: {
        Row: {
          committed_at: string | null
          created_at: string
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["ritual_kind"]
          period_start: string
          status: Database["public"]["Enums"]["ritual_status"]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          committed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          kind: Database["public"]["Enums"]["ritual_kind"]
          period_start: string
          status?: Database["public"]["Enums"]["ritual_status"]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          committed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["ritual_kind"]
          period_start?: string
          status?: Database["public"]["Enums"]["ritual_status"]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      weekly_entries: {
        Row: {
          arrow: Database["public"]["Enums"]["weekly_arrow"] | null
          created_at: string
          decision_text: string | null
          id: string
          missing_metrics: Json
          observations: Json
          priorities: Json
          ritual_session_id: string
          session_kind: Database["public"]["Enums"]["ritual_kind"]
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          arrow?: Database["public"]["Enums"]["weekly_arrow"] | null
          created_at?: string
          decision_text?: string | null
          id?: string
          missing_metrics?: Json
          observations?: Json
          priorities?: Json
          ritual_session_id: string
          session_kind?: Database["public"]["Enums"]["ritual_kind"]
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          arrow?: Database["public"]["Enums"]["weekly_arrow"] | null
          created_at?: string
          decision_text?: string | null
          id?: string
          missing_metrics?: Json
          observations?: Json
          priorities?: Json
          ritual_session_id?: string
          session_kind?: Database["public"]["Enums"]["ritual_kind"]
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_entries_session_fkey"
            columns: ["user_id", "ritual_session_id", "session_kind"]
            isOneToOne: true
            referencedRelation: "ritual_sessions"
            referencedColumns: ["user_id", "id", "kind"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commit_daily_ritual: {
        Args: {
          p_expected_version: number
          p_idempotency_key: string
          p_ritual_session_id: string
        }
        Returns: {
          committed_at: string
          ritual_session_id: string
          version: number
        }[]
      }
    }
    Enums: {
      area_status: "active" | "archived"
      blocker_type:
        | "internal"
        | "external_gate"
        | "capacity"
        | "clarity"
        | "dependency"
        | "other"
      commitment_event_kind:
        | "created"
        | "reworded"
        | "scored"
        | "done"
        | "partial"
        | "deferred"
        | "not_done"
        | "planned_skip"
        | "reopened"
      commitment_outcome:
        | "done"
        | "partial"
        | "deferred"
        | "not_done"
        | "planned_skip"
      commitment_state: "active" | "completed" | "archived"
      goal_status: "active" | "paused" | "completed" | "archived"
      key_date_kind: "deadline" | "milestone" | "event" | "review"
      notification_status:
        | "pending"
        | "claimed"
        | "sent"
        | "failed"
        | "cancelled"
      reminder_cadence: "once" | "daily" | "weekly"
      ritual_kind: "daily" | "weekly"
      ritual_status: "draft" | "committed"
      weekly_arrow: "up" | "steady" | "down"
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
      area_status: ["active", "archived"],
      blocker_type: [
        "internal",
        "external_gate",
        "capacity",
        "clarity",
        "dependency",
        "other",
      ],
      commitment_event_kind: [
        "created",
        "reworded",
        "scored",
        "done",
        "partial",
        "deferred",
        "not_done",
        "planned_skip",
        "reopened",
      ],
      commitment_outcome: [
        "done",
        "partial",
        "deferred",
        "not_done",
        "planned_skip",
      ],
      commitment_state: ["active", "completed", "archived"],
      goal_status: ["active", "paused", "completed", "archived"],
      key_date_kind: ["deadline", "milestone", "event", "review"],
      notification_status: [
        "pending",
        "claimed",
        "sent",
        "failed",
        "cancelled",
      ],
      reminder_cadence: ["once", "daily", "weekly"],
      ritual_kind: ["daily", "weekly"],
      ritual_status: ["draft", "committed"],
      weekly_arrow: ["up", "steady", "down"],
    },
  },
} as const
