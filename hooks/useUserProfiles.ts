import { useState, useEffect, useRef } from "react";
import { userProfilesApi } from "../lib/api";
import type { BadgeKey } from "../types/database.types";

interface ProfileInfo {
  displayName: string;
  showcaseBadgeKey: BadgeKey | null;
}

type ProfileMap = Record<string, ProfileInfo>;

/**
 * Hook that returns a userId → { displayName, showcaseBadgeKey } map for the
 * given IDs.
 *
 * Caching lives in the API layer (`userProfilesApi.getMany` uses an internal
 * TTL'd cache and batches network misses). This hook is a thin React wrapper
 * that forwards to it whenever the ID set changes.
 *
 * Invalidation: whoever mutates profiles (SettingsScreen upsert, showcase
 * badge selection, auth sign-out) goes through the API layer, so no
 * duplicate cache needs separate clearing.
 */
export function useUserProfiles(userIds: (string | null | undefined)[]) {
  const [profileMap, setProfileMap] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  const validIds = [...new Set(userIds.filter((id): id is string => !!id))];
  const idsKey = validIds.sort().join(",");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (validIds.length === 0) {
      setProfileMap({});
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setLoading(true);

    userProfilesApi
      .getMany(validIds)
      .then((fetchedMap) => {
        if (!mountedRef.current || fetchId !== fetchIdRef.current) return;
        const result: ProfileMap = {};
        for (const id of validIds) {
          const profile = fetchedMap.get(id);
          if (profile?.display_name) {
            result[id] = {
              displayName: profile.display_name,
              showcaseBadgeKey: profile.showcase_badge_key ?? null,
            };
          }
        }
        setProfileMap(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("useUserProfiles error:", err);
        if (mountedRef.current && fetchId === fetchIdRef.current) {
          setProfileMap({});
          setLoading(false);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return { profileMap, loading };
}
