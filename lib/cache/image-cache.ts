import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';

const STORAGE_KEY = '@image_dimensions';

interface Dimensions {
  width: number;
  height: number;
}

// In-memory cache for current session
const memoryCache = new Map<string, Dimensions>();

// Debounce timer for persisting to AsyncStorage
let persistTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Hydrate the in-memory cache from AsyncStorage on app startup.
 */
export async function initImageDimensionsCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: Record<string, Dimensions> = JSON.parse(raw);
      for (const [url, dims] of Object.entries(parsed)) {
        memoryCache.set(url, dims);
      }
    }
  } catch {
    // Non-critical — start with empty cache
  }
}

/**
 * Persist the in-memory cache to AsyncStorage (debounced).
 */
function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const obj: Record<string, Dimensions> = {};
    memoryCache.forEach((dims, url) => {
      obj[url] = dims;
    });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj)).catch(() => {});
  }, 2000);
}

/**
 * Get image dimensions, checking memory cache → AsyncStorage → network (via expo-image prefetch).
 */
export async function getImageDimensions(url: string): Promise<Dimensions> {
  // 1. Check memory cache
  const cached = memoryCache.get(url);
  if (cached) return cached;

  // 2. Fall back to loading via expo-image (which also warms the image cache)
  try {
    const result = await Image.prefetch(url, 'memory-disk');
    if (result && typeof result === 'object' && 'width' in result && 'height' in result) {
      const dims = { width: (result as any).width, height: (result as any).height };
      memoryCache.set(url, dims);
      schedulePersist();
      return dims;
    }
  } catch {
    // prefetch doesn't return dimensions on all platforms
  }

  // 3. Fall back to creating a temporary Image to measure
  return new Promise<Dimensions>((resolve, reject) => {
    // Use react-native Image.getSize as last resort
    const { Image: RNImage } = require('react-native');
    RNImage.getSize(
      url,
      (width: number, height: number) => {
        const dims = { width, height };
        memoryCache.set(url, dims);
        schedulePersist();
        resolve(dims);
      },
      (error: Error) => reject(error),
    );
  });
}

/**
 * Store known dimensions (e.g., from an onLoad event) to avoid future lookups.
 */
export function setImageDimensions(url: string, width: number, height: number): void {
  memoryCache.set(url, { width, height });
  schedulePersist();
}

/** Exposed for testing */
export function _clearCache(): void {
  memoryCache.clear();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}
