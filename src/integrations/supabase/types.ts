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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      daily_rates: {
        Row: {
          asof_date: string
          created_at: string | null
          date_time: string | null
          id: string
          inserted_by: string
          karat: string
          material: string
          n_price: number
          o_price: number
        }
        Insert: {
          asof_date: string
          created_at?: string | null
          date_time?: string | null
          id?: string
          inserted_by: string
          karat: string
          material: string
          n_price: number
          o_price: number
        }
        Update: {
          asof_date?: string
          created_at?: string | null
          date_time?: string | null
          id?: string
          inserted_by?: string
          karat?: string
          material?: string
          n_price?: number
          o_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_rates_inserted_by_fkey"
            columns: ["inserted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["username"]
          },
        ]
      }
      expense_log: {
        Row: {
          asof_date: string
          cost: number
          created_at: string | null
          date_time: string | null
          expense_type: string
          id: string
          inserted_by: string
          item_name: string
        }
        Insert: {
          asof_date: string
          cost: number
          created_at?: string | null
          date_time?: string | null
          expense_type: string
          id?: string
          inserted_by: string
          item_name: string
        }
        Update: {
          asof_date?: string
          cost?: number
          created_at?: string | null
          date_time?: string | null
          expense_type?: string
          id?: string
          inserted_by?: string
          item_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_log_inserted_by_fkey"
            columns: ["inserted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["username"]
          },
        ]
      }
      sales_log: {
        Row: {
          asof_date: string
          created_at: string | null
          customer_name: string
          customer_phone: string
          date_time: string | null
          id: string
          inserted_by: string
          item_name: string
          material: string
          o_cost: number | null
          o1_gram: number | null
          o1_purity: number | null
          o2_gram: number | null
          o2_purity: number | null
          p_cost: number
          p_grams: number
          p_purity: number
          profit: number
          s_cost: number
          s_purity: number | null
          tag_no: string
          type: string
          wastage: number | null
        }
        Insert: {
          asof_date: string
          created_at?: string | null
          customer_name: string
          customer_phone: string
          date_time?: string | null
          id?: string
          inserted_by: string
          item_name: string
          material: string
          o_cost?: number | null
          o1_gram?: number | null
          o1_purity?: number | null
          o2_gram?: number | null
          o2_purity?: number | null
          p_cost: number
          p_grams: number
          p_purity: number
          profit: number
          s_cost: number
          s_purity?: number | null
          tag_no: string
          type: string
          wastage?: number | null
        }
        Update: {
          asof_date?: string
          created_at?: string | null
          customer_name?: string
          customer_phone?: string
          date_time?: string | null
          id?: string
          inserted_by?: string
          item_name?: string
          material?: string
          o_cost?: number | null
          o1_gram?: number | null
          o1_purity?: number | null
          o2_gram?: number | null
          o2_purity?: number | null
          p_cost?: number
          p_grams?: number
          p_purity?: number
          profit?: number
          s_cost?: number
          s_purity?: number | null
          tag_no?: string
          type?: string
          wastage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_log_inserted_by_fkey"
            columns: ["inserted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["username"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          id: string
          password: string
          role: string
          sessionid: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password: string
          role: string
          sessionid?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password?: string
          role?: string
          sessionid?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
