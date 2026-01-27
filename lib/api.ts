import { supabase } from './supabase';
import { Database, Hold, DetectedHold, RouteFilters, Send, Comment } from '../types/database.types';

type Route = Database['public']['Tables']['routes']['Row'];
type Photo = Database['public']['Tables']['photos']['Row'];
type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

// Simple event emitter for cache invalidation
type InvalidationEvent = 'routes' | 'route' | 'photos' | 'detected_holds' | 'sends' | 'comments';
type Listener = () => void;

const listeners: Map<InvalidationEvent, Set<Listener>> = new Map();

export const cacheEvents = {
  subscribe(event: InvalidationEvent, listener: Listener): () => void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      listeners.get(event)?.delete(listener);
    };
  },

  invalidate(event: InvalidationEvent) {
    listeners.get(event)?.forEach(listener => listener());
  },
};

// Route with computed stats
export type RouteWithStats = Route & {
  avgRating: number | null;
  sendCount: number;
};

// Routes API
export const routesApi = {
  async list(filters?: RouteFilters): Promise<RouteWithStats[]> {
    let query = supabase
      .from('routes')
      .select('*, sends(quality_rating)')
      .order('created_at', { ascending: false });

    if (filters?.creatorId) {
      query = query.eq('user_id', filters.creatorId);
    }

    if (filters?.grade) {
      query = query.ilike('grade', `%${filters.grade}%`);
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Compute average rating from sends
    return (data || []).map((route: Route & { sends: { quality_rating: number | null }[] }) => {
      const ratings = route.sends
        .map(s => s.quality_rating)
        .filter((r): r is number => r !== null);
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : null;
      const { sends, ...routeData } = route;
      return {
        ...routeData,
        avgRating,
        sendCount: route.sends.length,
      };
    });
  },

  async get(routeId: string) {
    const { data, error } = await supabase
      .from('routes')
      .select(`
        *,
        photo:photos(*)
      `)
      .eq('id', routeId)
      .single();

    if (error) throw error;
    return data as Route & { photo?: Photo };
  },

  async create(route: {
    title: string;
    description: string | null;
    grade: string;
    photo_id: string;
    holds: Hold[];
    user_id: string;
  }) {
    const { data, error } = await supabase
      .from('routes')
      .insert(route)
      .select()
      .single();

    if (error) throw error;

    // Invalidate routes list cache
    cacheEvents.invalidate('routes');

    return data;
  },

  async update(routeId: string, updates: {
    title?: string;
    description?: string | null;
    grade?: string;
    photo_id?: string;
    holds?: Hold[];
  }) {
    const { error } = await supabase
      .from('routes')
      .update(updates)
      .eq('id', routeId);

    if (error) throw error;

    // Invalidate both routes list and specific route
    cacheEvents.invalidate('routes');
    cacheEvents.invalidate('route');
  },

  async delete(routeId: string) {
    const { error } = await supabase
      .from('routes')
      .delete()
      .eq('id', routeId);

    if (error) throw error;

    cacheEvents.invalidate('routes');
  },
};

// Photos API
export const photosApi = {
  async listActive() {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .or('teardown_date.is.null,teardown_date.gte.' + new Date().toISOString())
      .order('setup_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async get(photoId: string) {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (error) throw error;
    return data;
  },
};

// Detected Holds API
export const detectedHoldsApi = {
  async listByPhoto(photoId: string) {
    const { data, error } = await supabase
      .from('detected_holds')
      .select('*')
      .eq('photo_id', photoId);

    if (error) throw error;
    return (data || []) as DetectedHold[];
  },

  async update(holdId: string, updates: Partial<DetectedHold>) {
    const { error } = await supabase
      .from('detected_holds')
      .update(updates)
      .eq('id', holdId);

    if (error) throw error;

    cacheEvents.invalidate('detected_holds');
  },

  async create(hold: Omit<DetectedHold, 'id'>) {
    const { data, error } = await supabase
      .from('detected_holds')
      .insert(hold)
      .select()
      .single();

    if (error) throw error;

    cacheEvents.invalidate('detected_holds');

    return data as DetectedHold;
  },
};

// User Profiles API
export const userProfilesApi = {
  async get(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  },

  async upsert(userId: string, updates: { display_name: string }) {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        ...updates,
      })
      .select()
      .single();

    if (error) throw error;
    return data as UserProfile;
  },
};

// Sends API
export const sendsApi = {
  async listByRoute(routeId: string): Promise<Send[]> {
    const { data, error } = await supabase
      .from('sends')
      .select('*')
      .eq('route_id', routeId)
      .order('sent_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async listByUser(userId: string): Promise<(Send & { route: { id: string; title: string; grade: string } })[]> {
    const { data, error } = await supabase
      .from('sends')
      .select('*, route:routes(id, title, grade)')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByUserAndRoute(userId: string, routeId: string): Promise<Send | null> {
    const { data, error } = await supabase
      .from('sends')
      .select('*')
      .eq('user_id', userId)
      .eq('route_id', routeId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async create(send: {
    user_id: string;
    route_id: string;
    quality_rating?: number | null;
    difficulty_rating?: number | null;
    sent_at?: string;
  }): Promise<Send> {
    const { data, error } = await supabase
      .from('sends')
      .insert(send)
      .select()
      .single();

    if (error) throw error;
    cacheEvents.invalidate('sends');
    return data as Send;
  },

  async update(sendId: string, updates: {
    quality_rating?: number | null;
    difficulty_rating?: number | null;
    sent_at?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('sends')
      .update(updates)
      .eq('id', sendId);

    if (error) throw error;
    cacheEvents.invalidate('sends');
  },

  async delete(sendId: string): Promise<void> {
    const { error } = await supabase
      .from('sends')
      .delete()
      .eq('id', sendId);

    if (error) throw error;
    cacheEvents.invalidate('sends');
  },
};

// Comments API
export const commentsApi = {
  async listByRoute(routeId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('route_id', routeId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async listByUser(userId: string): Promise<(Comment & { route: { id: string; title: string; grade: string } })[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*, route:routes(id, title, grade)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(comment: {
    user_id: string;
    route_id: string;
    text: string;
  }): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .insert(comment)
      .select()
      .single();

    if (error) throw error;
    cacheEvents.invalidate('comments');
    return data as Comment;
  },

  async delete(commentId: string): Promise<void> {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
    cacheEvents.invalidate('comments');
  },
};
