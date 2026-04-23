export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface DetectedHold {
  id: string;
  photo_id: string;
  polygon: Array<{ x: number; y: number }>;
  center: { x: number; y: number };
  dominant_color?: string;
  created_at: string;
}

export interface Hold {
  detected_hold_id: string;
  labelX: number;
  labelY: number;
  note?: string;
  labelPinned?: boolean;
}

export interface HandHold extends Hold {
  order: number;
}

export interface FootHold extends Hold {}

export interface RouteHolds {
  hand_holds: HandHold[];
  foot_holds: FootHold[];
}

export type UserRelation = "created" | "saved" | "tried" | "sent";

export interface RouteFilters {
  grade?: string;
  search?: string;
  /**
   * Walls pill selection. Both false (or undefined) = show all walls with a
   * setup_date. Only active = current live walls. Only past = walls with a
   * teardown_date. Both true = same as both false (no constraint).
   */
  wallActive?: boolean;
  wallPast?: boolean;
  /**
   * User-relationship pill selection (FEAT-2). OR semantics: show routes
   * matching ANY selected relation. Caller resolves these to a union of route
   * ids via bookmarks / logs / own routes, then feeds them in via routeIds.
   */
  userRelations?: UserRelation[];
  /**
   * Restrict the list to these route ids. Caller-resolved. Empty array = no
   * matches (routesApi.list short-circuits).
   */
  routeIds?: string[];
}

export type LogStatus = "sent" | "attempted";

export interface Log {
  id: string;
  user_id: string;
  route_id: string;
  status: LogStatus;
  quality_rating: number | null;
  difficulty_rating: number | null;
  fall_hold_id: string | null;
  logged_at: string;
  created_at: string;
}

export interface Bookmark {
  id: string;
  user_id: string;
  route_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  route_id: string;
  text: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      admins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          created_at?: string;
        };
      };
      detected_holds: {
        Row: {
          id: string;
          photo_id: string;
          polygon: Json;
          center: Json;
          dominant_color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          photo_id: string;
          polygon: Json;
          center: Json;
          dominant_color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          photo_id?: string;
          polygon?: Json;
          center?: Json;
          dominant_color?: string | null;
          created_at?: string;
        };
      };
      photos: {
        Row: {
          id: string;
          created_at: string;
          image_url: string;
          setup_date: string | null;
          teardown_date: string | null;
          user_id: string;
          holds_version: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          image_url: string;
          setup_date?: string | null;
          teardown_date?: string | null;
          user_id: string;
          holds_version?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          image_url?: string;
          setup_date?: string | null;
          teardown_date?: string | null;
          user_id?: string;
          holds_version?: number;
        };
      };
      routes: {
        Row: {
          id: string;
          created_at: string;
          title: string;
          description: string | null;
          grade: string;
          photo_id: string;
          holds: RouteHolds;
          user_id: string;
          is_draft: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          title: string;
          description?: string | null;
          grade: string;
          photo_id: string;
          holds: RouteHolds;
          user_id: string;
          is_draft?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string;
          description?: string | null;
          grade?: string;
          photo_id?: string;
          holds?: RouteHolds;
          user_id?: string;
          is_draft?: boolean;
        };
      };
      user_profiles: {
        Row: {
          user_id: string;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      logs: {
        Row: {
          id: string;
          user_id: string;
          route_id: string;
          status: LogStatus;
          quality_rating: number | null;
          difficulty_rating: number | null;
          fall_hold_id: string | null;
          logged_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          route_id: string;
          status: LogStatus;
          quality_rating?: number | null;
          difficulty_rating?: number | null;
          fall_hold_id?: string | null;
          logged_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          route_id?: string;
          status?: LogStatus;
          quality_rating?: number | null;
          difficulty_rating?: number | null;
          fall_hold_id?: string | null;
          logged_at?: string;
          created_at?: string;
        };
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          route_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          route_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          route_id?: string;
          created_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          user_id: string;
          route_id: string;
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          route_id: string;
          text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          route_id?: string;
          text?: string;
          created_at?: string;
        };
      };
      app_config: {
        Row: {
          singleton_key: boolean;
          min_version: string;
          updated_at: string;
        };
        Insert: {
          singleton_key?: boolean;
          min_version?: string;
          updated_at?: string;
        };
        Update: {
          singleton_key?: boolean;
          min_version?: string;
          updated_at?: string;
        };
      };
      user_activity: {
        Row: {
          user_id: string;
          app_version: string;
          platform: "android" | "ios";
          os_version: string | null;
          last_seen_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          app_version: string;
          platform: "android" | "ios";
          os_version?: string | null;
          last_seen_at?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          app_version?: string;
          platform?: "android" | "ios";
          os_version?: string | null;
          last_seen_at?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      avg_rating: {
        Args: { "": unknown };
        Returns: number | null;
      };
      send_count: {
        Args: { "": unknown };
        Returns: number;
      };
      attempt_count: {
        Args: { "": unknown };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
