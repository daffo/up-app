import { useState, useEffect, useRef, useCallback } from 'react';
import { userProfilesApi } from '../lib/api';

type ProfileMap = Record<string, string>;

// Module-level session cache: userId → displayName (or undefined if no profile)
const sessionCache = new Map<string, string | undefined>();

/**
 * Hook that batches user profile fetches and caches results for the session.
 * Takes an array of user IDs and returns a map of userId → displayName.
 *
 * - Deduplicates IDs and skips already-cached ones
 * - Single batched query via userProfilesApi.getMany()
 * - Session-level cache persists across re-renders and component mounts
 */
export function useUserProfiles(userIds: (string | null | undefined)[]) {
  const [profileMap, setProfileMap] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  // Filter out null/undefined and deduplicate
  const validIds = [...new Set(userIds.filter((id): id is string => !!id))];
  // Stable serialization for effect dependency
  const idsKey = validIds.sort().join(',');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (validIds.length === 0) {
      setProfileMap({});
      return;
    }

    // Build result from cache, collect misses
    const cached: ProfileMap = {};
    const missingIds: string[] = [];

    for (const id of validIds) {
      if (sessionCache.has(id)) {
        const name = sessionCache.get(id);
        if (name) cached[id] = name;
      } else {
        missingIds.push(id);
      }
    }

    // If everything is cached, return immediately
    if (missingIds.length === 0) {
      setProfileMap(cached);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setLoading(true);

    userProfilesApi.getMany(missingIds).then((fetchedMap) => {
      if (!mountedRef.current || fetchId !== fetchIdRef.current) return;

      // Update session cache
      for (const id of missingIds) {
        const profile = fetchedMap.get(id);
        sessionCache.set(id, profile?.display_name || undefined);
      }

      // Build final map from cache
      const result: ProfileMap = { ...cached };
      for (const id of missingIds) {
        const name = sessionCache.get(id);
        if (name) result[id] = name;
      }

      setProfileMap(result);
      setLoading(false);
    }).catch((err) => {
      console.error('useUserProfiles error:', err);
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        // Still return whatever we had cached
        setProfileMap(cached);
        setLoading(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return { profileMap, loading };
}

/** Clear the session cache (useful for testing or logout). */
export function clearProfileSessionCache() {
  sessionCache.clear();
}

// Export for testing
export { sessionCache as _sessionCache };
