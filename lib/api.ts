import { supabase } from "./supabase";
import {
  Database,
  RouteHolds,
  DetectedHold,
  RouteFilters,
  Send,
  Comment,
  Log,
  LogStatus,
  Bookmark,
} from "../types/database.types";
import {
  getCachedHolds,
  getCachedHoldsAnyVersion,
  getCachedVersion,
  setCachedHolds,
  invalidateHoldsCache,
} from "./cache/detected-holds-cache";

type Route = Database["public"]["Tables"]["routes"]["Row"];
type Photo = Database["public"]["Tables"]["photos"]["Row"];
type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

// UUID v4 pattern
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ISO 8601 timestamp (with optional fractional seconds and Z or ±HH:MM offset)
const ISO_TS_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Validate pagination cursor values to prevent injection via .or() filter strings.
 * Throws if the cursor contains invalid values.
 */
export function validateCursor(cursor: {
  created_at: string;
  id: string;
}): void {
  if (!UUID_RE.test(cursor.id)) {
    throw new Error("Invalid cursor: id must be a valid UUID");
  }
  if (!ISO_TS_RE.test(cursor.created_at)) {
    throw new Error(
      "Invalid cursor: created_at must be a valid ISO 8601 timestamp",
    );
  }
}

/**
 * Escape a string for safe use inside a PostgREST filter value.
 * PostgREST uses commas, dots, parentheses, and backslashes as operators
 * in filter strings — these must be backslash-escaped when they appear in values.
 */
export function sanitizeFilterValue(value: string): string {
  return value.replace(/[\\.,()]/g, (ch) => `\\${ch}`);
}

// Simple event emitter for cache invalidation
export const CACHE_EVENTS = {
  ROUTES: "routes",
  ROUTE: "route",
  PHOTOS: "photos",
  DETECTED_HOLDS: "detected_holds",
  SENDS: "sends",
  LOGS: "logs",
  BOOKMARKS: "bookmarks",
  COMMENTS: "comments",
} as const;

type InvalidationEvent = (typeof CACHE_EVENTS)[keyof typeof CACHE_EVENTS];
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
    listeners.get(event)?.forEach((listener) => listener());
  },
};

// Typed invalidation helpers
const invalidateRoutes = () => cacheEvents.invalidate(CACHE_EVENTS.ROUTES);
const invalidateRoute = () => cacheEvents.invalidate(CACHE_EVENTS.ROUTE);
const invalidatePhotos = () => cacheEvents.invalidate(CACHE_EVENTS.PHOTOS);
const invalidateDetectedHolds = () =>
  cacheEvents.invalidate(CACHE_EVENTS.DETECTED_HOLDS);
const invalidateSends = () => cacheEvents.invalidate(CACHE_EVENTS.SENDS);
const invalidateLogs = () => cacheEvents.invalidate(CACHE_EVENTS.LOGS);
const invalidateBookmarks = () =>
  cacheEvents.invalidate(CACHE_EVENTS.BOOKMARKS);
const invalidateComments = () => cacheEvents.invalidate(CACHE_EVENTS.COMMENTS);

// Route with computed stats
export type RouteWithStats = Route & {
  avgRating: number | null;
  sendCount: number;
};

// Routes API
export type PaginationOptions = {
  cursor?: { created_at: string; id: string };
  pageSize?: number;
};

export const routesApi = {
  async list(
    filters?: RouteFilters,
    pagination?: PaginationOptions,
  ): Promise<{ data: RouteWithStats[]; hasMore: boolean }> {
    const pageSize = pagination?.pageSize ?? 20;

    let query = supabase
      .from("routes")
      .select(
        "*, avg_rating, send_count, photo:photos!inner(setup_date, teardown_date)",
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    // Walls filter. Both off / both on = no wall status constraint (all walls
    // with a setup_date). Only active = current live walls. Only past = walls
    // with a teardown_date.
    const wallActive = !!filters?.wallActive;
    const wallPast = !!filters?.wallPast;
    if (wallActive && !wallPast) {
      query = query
        .not("photo.setup_date", "is", null)
        .is("photo.teardown_date", null);
    } else if (wallPast && !wallActive) {
      query = query.not("photo.teardown_date", "is", null);
    } else {
      // Neither or both — still require setup_date so we don't surface
      // walls that never went live.
      query = query.not("photo.setup_date", "is", null);
    }

    if (filters?.routeIds) {
      if (filters.routeIds.length === 0) {
        // Empty set means no matches — skip the query entirely.
        return { data: [], hasMore: false };
      }
      query = query.in("id", filters.routeIds);
    }

    if (filters?.grade) {
      const safeGrade = filters.grade.replace(/[%_]/g, (ch) => `\\${ch}`);
      query = query.ilike("grade", `%${safeGrade}%`);
    }

    if (filters?.search) {
      const sanitized = sanitizeFilterValue(filters.search);
      query = query.or(
        `title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`,
      );
    }

    // Cursor-based pagination with tiebreaker
    if (pagination?.cursor) {
      validateCursor(pagination.cursor);
      const { created_at, id } = pagination.cursor;
      query = query.or(
        `created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`,
      );
    }

    // Fetch one extra to detect if there are more results
    query = query.limit(pageSize + 1);

    const { data, error } = await query;

    if (error) throw error;

    const rows = data || [];
    const hasMore = rows.length > pageSize;
    const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

    // Use server-computed avg_rating and send_count (PostgREST computed columns)
    const mapped = pageRows.map(
      (
        route: Route & {
          avg_rating: number | null;
          send_count: number;
          photo: unknown;
        },
      ) => {
        const { avg_rating, send_count, photo, ...routeData } = route;
        return {
          ...routeData,
          avgRating: avg_rating,
          sendCount: send_count,
        };
      },
    );

    return { data: mapped, hasMore };
  },

  async listByPhoto(photoId: string): Promise<Route[]> {
    const { data, error } = await supabase
      .from("routes")
      .select("*")
      .eq("photo_id", photoId);

    if (error) throw error;
    return (data || []) as Route[];
  },

  async listIdsByCreator(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("routes")
      .select("id")
      .eq("user_id", userId);

    if (error) throw error;
    return (data || []).map((r: { id: string }) => r.id);
  },

  async get(routeId: string) {
    const { data, error } = await supabase
      .from("routes")
      .select(
        `
        *,
        photo:photos(*)
      `,
      )
      .eq("id", routeId)
      .maybeSingle();

    if (error) throw error;
    return data as (Route & { photo?: Photo }) | null;
  },

  async create(route: {
    title: string;
    description: string | null;
    grade: string;
    photo_id: string;
    holds: RouteHolds;
    user_id: string;
    is_draft?: boolean;
  }) {
    const { data, error } = await supabase
      .from("routes")
      .insert(route)
      .select()
      .single();

    if (error) throw error;

    invalidateRoutes();

    return data;
  },

  async update(
    routeId: string,
    updates: {
      title?: string;
      description?: string | null;
      grade?: string;
      photo_id?: string;
      holds?: RouteHolds;
      is_draft?: boolean;
    },
  ) {
    const { error } = await supabase
      .from("routes")
      .update(updates)
      .eq("id", routeId);

    if (error) throw error;

    invalidateRoutes();
    invalidateRoute();
  },

  async delete(routeId: string) {
    const { error } = await supabase.from("routes").delete().eq("id", routeId);

    if (error) throw error;

    invalidateRoutes();
    invalidateRoute();
  },

  async getWithDetails(routeId: string): Promise<{
    route: (Route & { photo?: Photo }) | null;
    detectedHolds: DetectedHold[];
  }> {
    const fetchedRoute = await routesApi.get(routeId);
    if (!fetchedRoute) {
      return { route: null, detectedHolds: [] };
    }

    let detectedHolds: DetectedHold[] = [];
    if (fetchedRoute.photo_id) {
      try {
        const holdsVersion = (fetchedRoute as any).photo?.holds_version;
        detectedHolds = await detectedHoldsApi.listByPhoto(
          fetchedRoute.photo_id,
          holdsVersion,
        );
      } catch {
        // Fallback to empty detected holds
      }
    }

    return { route: fetchedRoute, detectedHolds };
  },
};

// Photos API
export const photosApi = {
  async listAll() {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async listActive() {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .not("setup_date", "is", null)
      .or("teardown_date.is.null,teardown_date.gte." + new Date().toISOString())
      .order("setup_date", { ascending: false });

    if (error) throw error;
    const photos = data || [];

    // Fire-and-forget: prefetch detected holds into local cache
    detectedHoldsApi.prefetchForPhotos(photos).catch(() => {});

    return photos;
  },

  async get(photoId: string) {
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("id", photoId)
      .single();

    if (error) throw error;
    return data;
  },

  async update(
    photoId: string,
    updates: { setup_date?: string | null; teardown_date?: string | null },
  ) {
    const { error } = await supabase
      .from("photos")
      .update(updates)
      .eq("id", photoId);

    if (error) throw error;

    invalidatePhotos();
  },
};

// Detected Holds API
export const detectedHoldsApi = {
  async listByPhoto(
    photoId: string,
    holdsVersion?: number,
    forceRefresh = false,
  ) {
    if (!forceRefresh) {
      if (holdsVersion !== undefined) {
        // Exact version check — cache hit only if version matches
        const cached = await getCachedHolds(photoId, holdsVersion);
        if (cached) return cached;
      } else {
        // No version available — serve any cached data
        const cached = await getCachedHoldsAnyVersion(photoId);
        if (cached) return cached;
      }
    }

    const { data, error } = await supabase
      .from("detected_holds")
      .select("*")
      .eq("photo_id", photoId);

    if (error) throw error;
    const holds = (data || []) as DetectedHold[];

    // Cache with version if known
    if (holdsVersion !== undefined) {
      setCachedHolds(photoId, holdsVersion, holds).catch(() => {});
    }

    return holds;
  },

  async prefetchForPhotos(
    photos: { id: string; holds_version: number }[],
  ): Promise<void> {
    for (const photo of photos) {
      if (!photo.holds_version) continue;
      const cachedVersion = await getCachedVersion(photo.id);
      if (cachedVersion === photo.holds_version) continue;
      // Cache miss or version mismatch — fetch and cache
      try {
        await detectedHoldsApi.listByPhoto(photo.id, photo.holds_version);
      } catch {
        // Non-critical: prefetch failure should not block anything
      }
    }
  },

  async update(
    holdId: string,
    updates: Partial<DetectedHold>,
    photoId?: string,
  ) {
    const { error } = await supabase
      .from("detected_holds")
      .update(updates)
      .eq("id", holdId);

    if (error) throw error;

    if (photoId) invalidateHoldsCache(photoId).catch(() => {});
    invalidateDetectedHolds();
  },

  async create(hold: Omit<DetectedHold, "id">) {
    const { data, error } = await supabase
      .from("detected_holds")
      .insert(hold)
      .select()
      .single();

    if (error) throw error;

    invalidateHoldsCache(hold.photo_id).catch(() => {});
    invalidateDetectedHolds();

    return data as DetectedHold;
  },

  async createMany(holds: Omit<DetectedHold, "id">[]): Promise<DetectedHold[]> {
    if (holds.length === 0) return [];

    const { data, error } = await supabase
      .from("detected_holds")
      .insert(holds)
      .select();

    if (error) throw error;

    // Invalidate cache for all affected photos
    const photoIds = new Set(holds.map((h) => h.photo_id));
    photoIds.forEach((pid) => invalidateHoldsCache(pid).catch(() => {}));
    invalidateDetectedHolds();

    return (data || []) as DetectedHold[];
  },

  async delete(holdId: string, photoId?: string): Promise<void> {
    const { error } = await supabase
      .from("detected_holds")
      .delete()
      .eq("id", holdId);

    if (error) throw error;

    if (photoId) invalidateHoldsCache(photoId).catch(() => {});
    invalidateDetectedHolds();
  },

  async deleteByPhoto(photoId: string): Promise<void> {
    const { error } = await supabase
      .from("detected_holds")
      .delete()
      .eq("photo_id", photoId);

    if (error) throw error;

    invalidateHoldsCache(photoId).catch(() => {});
    invalidateDetectedHolds();
  },
};

// Account API
export const accountApi = {
  async deleteAllUserData(userId: string): Promise<void> {
    // Delete in order: bookmarks, logs, sends, comments, routes, profile.
    // Bookmarks/logs first — sends kept during FEAT-2 bridge alongside logs.
    const { error: bookmarksError } = await supabase
      .from("bookmarks")
      .delete()
      .eq("user_id", userId);
    if (bookmarksError) throw bookmarksError;

    const { error: logsError } = await supabase
      .from("logs")
      .delete()
      .eq("user_id", userId);
    if (logsError) throw logsError;

    const { error: sendsError } = await supabase
      .from("sends")
      .delete()
      .eq("user_id", userId);
    if (sendsError) throw sendsError;

    const { error: commentsError } = await supabase
      .from("comments")
      .delete()
      .eq("user_id", userId);
    if (commentsError) throw commentsError;

    const { error: routesError } = await supabase
      .from("routes")
      .delete()
      .eq("user_id", userId);
    if (routesError) throw routesError;

    const { error: profileError } = await supabase
      .from("user_profiles")
      .delete()
      .eq("user_id", userId);
    if (profileError) throw profileError;

    invalidateBookmarks();
    invalidateLogs();
    invalidateSends();
    invalidateComments();
    invalidateRoutes();
  },
};

// User Profiles API
// In-memory profile cache with TTL (invalidated on upsert)
const PROFILE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const profileCache = new Map<
  string,
  { profile: UserProfile | null; fetchedAt: number }
>();

export const userProfilesApi = {
  async get(userId: string): Promise<UserProfile | null> {
    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < PROFILE_TTL_MS)
      return cached.profile;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    profileCache.set(userId, { profile: data, fetchedAt: Date.now() });
    return data;
  },

  async upsert(userId: string, updates: { display_name: string | null }) {
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert({
        user_id: userId,
        ...updates,
      })
      .select()
      .single();

    if (error) throw error;
    const profile = data as UserProfile;
    profileCache.set(userId, { profile, fetchedAt: Date.now() });
    return profile;
  },

  async getMany(userIds: string[]): Promise<Map<string, UserProfile>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();

    // Check cache first, collect misses
    const result = new Map<string, UserProfile>();
    const missingIds: string[] = [];

    for (const id of unique) {
      const cached = profileCache.get(id);
      if (cached && Date.now() - cached.fetchedAt < PROFILE_TTL_MS) {
        if (cached.profile) result.set(id, cached.profile);
      } else {
        missingIds.push(id);
      }
    }

    // Batch fetch missing profiles in a single query
    if (missingIds.length > 0) {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .in("user_id", missingIds);

      if (error) throw error;

      const fetchedMap = new Map(
        (data || []).map((p: UserProfile) => [p.user_id, p]),
      );
      const now = Date.now();

      for (const id of missingIds) {
        const profile = fetchedMap.get(id) || null;
        profileCache.set(id, { profile, fetchedAt: now });
        if (profile) result.set(id, profile);
      }
    }

    return result;
  },

  clearCache() {
    profileCache.clear();
  },
};

// Sends API
export const sendsApi = {
  async listByRoute(routeId: string): Promise<Send[]> {
    const { data, error } = await supabase
      .from("sends")
      .select("*")
      .eq("route_id", routeId)
      .order("sent_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async listByUser(
    userId: string,
  ): Promise<
    (Send & { route: { id: string; title: string; grade: string } })[]
  > {
    const { data, error } = await supabase
      .from("sends")
      .select("*, route:routes(id, title, grade)")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getByUserAndRoute(
    userId: string,
    routeId: string,
  ): Promise<Send | null> {
    const { data, error } = await supabase
      .from("sends")
      .select("*")
      .eq("user_id", userId)
      .eq("route_id", routeId)
      .maybeSingle();

    if (error) throw error;
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
      .from("sends")
      .insert(send)
      .select()
      .single();

    if (error) throw error;
    invalidateSends();
    invalidateRoutes();
    return data as Send;
  },

  async update(
    sendId: string,
    updates: {
      quality_rating?: number | null;
      difficulty_rating?: number | null;
      sent_at?: string;
    },
  ): Promise<void> {
    const { error } = await supabase
      .from("sends")
      .update(updates)
      .eq("id", sendId);

    if (error) throw error;
    invalidateSends();
    invalidateRoutes();
  },

  async delete(sendId: string): Promise<void> {
    const { error } = await supabase.from("sends").delete().eq("id", sendId);

    if (error) throw error;
    invalidateSends();
    invalidateRoutes();
  },
};

// Logs API (FEAT-2 — replaces sendsApi in new app; sendsApi kept during bridge)
export type LogUpsertInput = {
  user_id: string;
  route_id: string;
  status: LogStatus;
  quality_rating?: number | null;
  difficulty_rating?: number | null;
  fall_hold_id?: string | null;
};

export const logsApi = {
  async listByRoute(routeId: string, status?: LogStatus): Promise<Log[]> {
    let query = supabase
      .from("logs")
      .select("*")
      .eq("route_id", routeId)
      .order("logged_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async listByUser(
    userId: string,
    statuses?: LogStatus[],
  ): Promise<
    (Log & { route: { id: string; title: string; grade: string } })[]
  > {
    let query = supabase
      .from("logs")
      .select("*, route:routes(id, title, grade)")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false });

    if (statuses && statuses.length > 0) {
      query = query.in("status", statuses);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getByUserAndRoute(
    userId: string,
    routeId: string,
  ): Promise<Log | null> {
    const { data, error } = await supabase
      .from("logs")
      .select("*")
      .eq("user_id", userId)
      .eq("route_id", routeId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsert(input: LogUpsertInput): Promise<Log> {
    // Enforce status-conditional fields client-side; DB CHECK is the final gate
    if (input.status === "attempted" && input.difficulty_rating != null) {
      throw new Error("difficulty_rating only allowed when status=sent");
    }
    if (input.status === "sent" && input.fall_hold_id != null) {
      throw new Error("fall_hold_id only allowed when status=attempted");
    }

    const row = {
      user_id: input.user_id,
      route_id: input.route_id,
      status: input.status,
      quality_rating: input.quality_rating ?? null,
      // Clear the field not applicable for this status, so re-log overrides work
      difficulty_rating:
        input.status === "sent" ? input.difficulty_rating ?? null : null,
      fall_hold_id:
        input.status === "attempted" ? input.fall_hold_id ?? null : null,
      logged_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("logs")
      .upsert(row, { onConflict: "user_id,route_id" })
      .select()
      .single();

    if (error) throw error;
    invalidateLogs();
    invalidateRoutes();
    return data as Log;
  },

  async delete(userId: string, routeId: string): Promise<void> {
    const { error } = await supabase
      .from("logs")
      .delete()
      .eq("user_id", userId)
      .eq("route_id", routeId);

    if (error) throw error;
    invalidateLogs();
    invalidateRoutes();
  },
};

// Bookmarks API (FEAT-2)
export const bookmarksApi = {
  async list(
    userId: string,
  ): Promise<
    (Bookmark & { route: { id: string; title: string; grade: string } })[]
  > {
    const { data, error } = await supabase
      .from("bookmarks")
      .select("*, route:routes(id, title, grade)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async isBookmarked(userId: string, routeId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", userId)
      .eq("route_id", routeId)
      .maybeSingle();

    if (error) throw error;
    return data != null;
  },

  async toggle(userId: string, routeId: string): Promise<boolean> {
    const exists = await bookmarksApi.isBookmarked(userId, routeId);

    if (exists) {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("route_id", routeId);
      if (error) throw error;
      invalidateBookmarks();
      return false;
    }

    const { error } = await supabase
      .from("bookmarks")
      .insert({ user_id: userId, route_id: routeId });
    if (error) throw error;
    invalidateBookmarks();
    return true;
  },
};

// Comments API
export const commentsApi = {
  async listByRoute(routeId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("route_id", routeId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async listByUser(
    userId: string,
  ): Promise<
    (Comment & { route: { id: string; title: string; grade: string } })[]
  > {
    const { data, error } = await supabase
      .from("comments")
      .select("*, route:routes(id, title, grade)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(comment: {
    user_id: string;
    route_id: string;
    text: string;
  }): Promise<Comment> {
    const { data, error } = await supabase
      .from("comments")
      .insert(comment)
      .select()
      .single();

    if (error) throw error;
    invalidateComments();
    return data as Comment;
  },

  async delete(commentId: string): Promise<void> {
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (error) throw error;
    invalidateComments();
  },
};

// App Config API
export const appConfigApi = {
  async getMinVersion(): Promise<string> {
    const { data, error } = await supabase
      .from("app_config")
      .select("min_version")
      .single();

    if (error) throw error;
    return data.min_version;
  },
};

// User Activity API
export const userActivityApi = {
  async upsert(activity: {
    user_id: string;
    app_version: string;
    platform: "android" | "ios";
    os_version: string | null;
  }): Promise<void> {
    const { error } = await supabase.from("user_activity").upsert(
      {
        ...activity,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;
  },
};
