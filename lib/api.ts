import { supabase } from './supabase';
import { Database, Hold, DetectedHold, RouteFilters } from '../types/database.types';

type Route = Database['public']['Tables']['routes']['Row'];
type Photo = Database['public']['Tables']['photos']['Row'];
type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

// Simple event emitter for cache invalidation
type InvalidationEvent = 'routes' | 'route' | 'photos' | 'detected_holds';
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

// Routes API
export const routesApi = {
  async list(filters?: RouteFilters) {
    let query = supabase
      .from('routes')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.creatorId) {
      query = query.eq('user_id', filters.creatorId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
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
