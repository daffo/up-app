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
 * Load a cache entry from AsyncStorage into memory (if not already there).
 * Returns the entry or null.
 */
async function loadEntry(photoId: string): Promise<CacheEntry | null> {
  const mem = memoryCache.get(photoId);
  if (mem) return mem;

  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + photoId);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      memoryCache.set(photoId, entry);
      return entry;
    }
  } catch {
    // Non-critical
  }

  return null;
}

/**
 * Get cached detected holds for a photo if the version matches.
 * Returns null if no cache or version mismatch.
 */
export async function getCachedHolds(
  photoId: string,
  holdsVersion: number,
): Promise<DetectedHold[] | null> {
  const entry = await loadEntry(photoId);
  if (entry && entry.version === holdsVersion) {
    return entry.holds;
  }
  return null;
}

/**
 * Get cached detected holds regardless of version.
 * Returns whatever is cached, or null if nothing cached.
 */
export async function getCachedHoldsAnyVersion(
  photoId: string,
): Promise<DetectedHold[] | null> {
  const entry = await loadEntry(photoId);
  return entry ? entry.holds : null;
}

/**
 * Get the cached version number for a photo's holds.
 * Useful for prefetch to check staleness without loading full holds.
 */
export async function getCachedVersion(
  photoId: string,
): Promise<number | null> {
  const entry = await loadEntry(photoId);
  return entry ? entry.version : null;
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
