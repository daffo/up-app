export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Hold {
  order: number
  holdX: number
  holdY: number
  labelX: number
  labelY: number
  radius: number
  note?: string
}

export interface Database {
  public: {
    Tables: {
      admins: {
        Row: {
          user_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          created_at?: string
        }
      }
      photos: {
        Row: {
          id: string
          created_at: string
          image_url: string
          setup_date: string
          teardown_date: string | null
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          image_url: string
          setup_date: string
          teardown_date?: string | null
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          image_url?: string
          setup_date?: string
          teardown_date?: string | null
          user_id?: string
        }
      }
      routes: {
        Row: {
          id: string
          created_at: string
          title: string
          description: string | null
          grade: string
          photo_id: string
          holds: Hold[]
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          description?: string | null
          grade: string
          photo_id: string
          holds: Hold[]
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string | null
          grade?: string
          photo_id?: string
          holds?: Hold[]
          user_id?: string
        }
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
  }
}
