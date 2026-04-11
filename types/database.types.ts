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
  detected_hold_id: string
  labelX: number
  labelY: number
  note?: string
  labelPinned?: boolean
}

export interface HandHold extends Hold {
  order: number
}

export interface FootHold extends Hold {}

export interface RouteHolds {
  hand_holds: HandHold[]
  foot_holds: FootHold[]
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
          holds_version: number
        }
        Insert: {
          id?: string
          created_at?: string
          image_url: string
          setup_date?: string | null
          teardown_date?: string | null
          user_id: string
          holds_version?: number
        }
        Update: {
          id?: string
          created_at?: string
          image_url?: string
          setup_date?: string | null
          teardown_date?: string | null
          user_id?: string
          holds_version?: number
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
          holds: RouteHolds
          user_id: string
          is_draft: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          description?: string | null
          grade: string
          photo_id: string
          holds: RouteHolds
          user_id: string
          is_draft?: boolean
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string | null
          grade?: string
          photo_id?: string
          holds?: RouteHolds
          user_id?: string
          is_draft?: boolean
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
      app_config: {
        Row: {
          singleton_key: boolean
          min_version: string
          updated_at: string
        }
        Insert: {
          singleton_key?: boolean
          min_version?: string
          updated_at?: string
        }
        Update: {
          singleton_key?: boolean
          min_version?: string
          updated_at?: string
        }
      }
      user_activity: {
        Row: {
          user_id: string
          app_version: string
          platform: 'android' | 'ios'
          os_version: string | null
          last_seen_at: string
          created_at: string
        }
        Insert: {
          user_id: string
          app_version: string
          platform: 'android' | 'ios'
          os_version?: string | null
          last_seen_at?: string
          created_at?: string
        }
        Update: {
          user_id?: string
          app_version?: string
          platform?: 'android' | 'ios'
          os_version?: string | null
          last_seen_at?: string
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
