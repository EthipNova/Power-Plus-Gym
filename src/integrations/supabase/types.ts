export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CustomerRow = {
  id: string
  customer_code: string
  user_id?: string | null
  first_name: string
  last_name: string
  phone: string
  email: string | null
  national_id?: string | null
  date_of_birth?: string | null
  gender?: string | null
  address?: string | null
  join_date: string
  status: string
  notes?: string | null
  customer_type: string
  created_at: string
  updated_at: string
}

export type AttendanceRow = {
  id: string
  customer_id: string
  checked_in_at: string
  check_in_method: string
  recorded_by?: string | null
  notes?: string | null
}

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: CustomerRow
        Insert: {
          id?: string
          customer_code: string
          user_id?: string | null
          first_name: string
          last_name: string
          phone: string
          email?: string | null
          national_id?: string | null
          date_of_birth?: string | null
          gender?: string | null
          address?: string | null
          join_date?: string
          status?: string
          notes?: string | null
          customer_type?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<CustomerRow>
        Relationships: []
      }
      attendance: {
        Row: AttendanceRow
        Insert: {
          id?: string
          customer_id: string
          checked_in_at?: string
          check_in_method?: string
          recorded_by?: string | null
          notes?: string | null
        }
        Update: Partial<AttendanceRow>
        Relationships: []
      }
      memberships: {
        Row: {
          id: string
          customer_id: string
          plan_id: string
          start_date: string
          end_date: string
          status: string
          price_at_purchase?: number | null
          auto_renew?: boolean | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: string
          customer_id: string
          plan_id: string
          start_date: string
          end_date: string
          status?: string
          price_at_purchase?: number | null
          auto_renew?: boolean | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<{
          id: string
          customer_id: string
          plan_id: string
          start_date: string
          end_date: string
          status: string
          price_at_purchase?: number | null
          auto_renew?: boolean | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }>
        Relationships: []
      }
      lockers: {
        Row: {
          id: string
          locker_number: string
          status: string
          key_number?: string | null
          location?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Insert: {
          id?: string
          locker_number: string
          status?: string
          key_number?: string | null
          location?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: Partial<{
          id: string
          locker_number: string
          status: string
          key_number: string | null
          location: string | null
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }>
        Relationships: []
      }
      locker_assignments: {
        Row: {
          id: string
          locker_id: string
          customer_id: string
          assigned_at: string
          returned_at?: string | null
          status: string
          notes?: string | null
          key_recipient?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Insert: {
          id?: string
          locker_id: string
          customer_id: string
          assigned_at?: string
          returned_at?: string | null
          status?: string
          notes?: string | null
          key_recipient?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: Partial<{
          id: string
          locker_id: string
          customer_id: string
          assigned_at: string
          returned_at: string | null
          status: string
          notes: string | null
          key_recipient: string | null
          created_at: string
          updated_at: string | null
        }>
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
