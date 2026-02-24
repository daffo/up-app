export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface DetectedHold {
  id: string
  photo_id: string
  polygon: Array<{ x: number; y: number }>
  center: { x: number; y: number }
  dominant_color?: string
  created_at: string
}

export interface Hold {
  order: number
  detected_hold_id: string
  labelX: number
  labelY: number
  note?: string
}

export interface RouteFilters {
  creatorId?: string
  grade?: string
  search?: string
  wallStatus?: 'active' | 'past' | 'all'
}

export interface Send {
  id: string
  user_id: string
  route_id: string
  quality_rating: number | null
  difficulty_rating: number | null
  sent_at: string
  created_at: string
}

export interface Comment {
  id: string
  user_id: string
  route_id: string
  text: string
  created_at: string
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
      detected_holds: {
        Row: {
          id: string
          photo_id: string
          polygon: Json
          center: Json
          dominant_color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          photo_id: string
          polygon: Json
          center: Json
          dominant_color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          photo_id?: string
          polygon?: Json
          center?: Json
          dominant_color?: string | null
          created_at?: string
        }
      }
      photos: {
        Row: {
          id: string
          created_at: string
          image_url: string
          setup_date: string | null
          teardown_date: string | null
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          image_url: string
          setup_date?: string | null
          teardown_date?: string | null
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          image_url?: string
          setup_date?: string | null
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
      user_profiles: {
        Row: {
          user_id: string
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sends: {
        Row: {
          id: string
          user_id: string
          route_id: string
          quality_rating: number | null
          difficulty_rating: number | null
          sent_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          route_id: string
          quality_rating?: number | null
          difficulty_rating?: number | null
          sent_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          route_id?: string
          quality_rating?: number | null
          difficulty_rating?: number | null
          sent_at?: string
          created_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          user_id: string
          route_id: string
          text: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          route_id: string
          text: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          route_id?: string
          text?: string
          created_at?: string
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
