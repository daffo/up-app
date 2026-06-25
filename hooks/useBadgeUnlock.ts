import { useEffect, useState, useRef, useCallback } from "react";
import { AppState } from "react-native";
import { badgesApi, cacheEvents, CACHE_EVENTS } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import type { BadgeKey } from "../types/database.types";

/**
 * Detects newly-earned (unseen) badges and surfaces them one at a time.
 *
 * Awarding is server-authoritative (Postgres triggers), so the client polls
 * for unseen rows after any badge-affecting mutation (BADGES cache event),
 * on mount, and whenever the app returns to the foreground — the latter
 * catches badges earned while away (e.g. Crowd Pleaser).
 *
 * Detection is intentionally decoupled from delivery so push (FEAT-1) can be
 * a drop-in later.
 */
export function useBadgeUnlock() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<BadgeKey | null>(null);
  const queueRef = useRef<BadgeKey[]>([]);
  const checkingRef = useRef(false);

  const showNext = useCallback(() => {
    if (current !== null) return; // a toast is already visible
    const next = queueRef.current.shift();
    if (next) setCurrent(next);
  }, [current]);

  const check = useCallback(async () => {
    if (!user || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const unseen = await badgesApi.listUnseen(user.id);
      if (unseen.length > 0) {
        const keys = unseen.map((b) => b.badge_key);
        queueRef.current.push(...keys);
        // Mark seen immediately so a refetch/foreground can't re-queue them.
        await badgesApi.markSeen(user.id, keys);
        showNext();
      }
    } catch (err) {
      console.error("useBadgeUnlock check failed:", err);
    } finally {
      checkingRef.current = false;
    }
  }, [user, showNext]);

  // Advance the queue whenever the current toast is dismissed.
  const dismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  useEffect(() => {
    if (current === null) showNext();
  }, [current, showNext]);

  // Initial check + subscribe to badge-affecting mutations.
  useEffect(() => {
    if (!user) {
      queueRef.current = [];
      setCurrent(null);
      return;
    }
    check();
    const unsub = cacheEvents.subscribe(CACHE_EVENTS.BADGES, () => check());
    return unsub;
  }, [user, check]);

  // Re-check when the app returns to the foreground.
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, [user, check]);

  return { current, dismiss };
}
