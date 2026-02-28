import AsyncStorage from '@react-native-async-storage/async-storage';
import { DetectedHold } from '../../types/database.types';

const STORAGE_PREFIX = '@detected_holds:';

interface CacheEntry {
  version: number;
  holds: DetectedHold[];
}

// In-memory cache for current session
const memoryCache = new Map<string, CacheEntry>();

/**
 * Get cached detected holds for a photo if the version matches.
 * Returns null if no cache or version mismatch.
 */
export async function getCachedHolds(
  photoId: string,
  holdsVersion: number,
): Promise<DetectedHold[] | null> {
  // 1. Check memory cache
  const mem = memoryCache.get(photoId);
  if (mem && mem.version === holdsVersion) {
    return mem.holds;
  }

  // 2. Check AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + photoId);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      if (entry.version === holdsVersion) {
        // Warm memory cache
        memoryCache.set(photoId, entry);
        return entry.holds;
      }
    }
  } catch {
    // Non-critical
  }

  return null;
}

/**
 * Store detected holds in both memory and AsyncStorage.
 */
export async function setCachedHolds(
  photoId: string,
  version: number,
  holds: DetectedHold[],
): Promise<void> {
  const entry: CacheEntry = { version, holds };
  memoryCache.set(photoId, entry);

  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + photoId, JSON.stringify(entry));
  } catch {
    // Non-critical
  }
}

/**
 * Invalidate cache for a specific photo (after admin edits holds).
 */
export async function invalidateHoldsCache(photoId: string): Promise<void> {
  memoryCache.delete(photoId);
  try {
    await AsyncStorage.removeItem(STORAGE_PREFIX + photoId);
  } catch {
    // Non-critical
  }
}

/** Exposed for testing */
export function _clearCache(): void {
  memoryCache.clear();
}
