import { File, Directory, Paths } from 'expo-file-system';

const CACHE_DIR_NAME = 'image-cache';

// In-memory map: remote URL → local file URI
const memoryCache = new Map<string, string>();

// In-flight downloads: dedup concurrent requests for the same URL
const inFlight = new Map<string, Promise<string>>();

/**
 * Ensure the cache directory exists (called once lazily).
 */
let dirReady = false;
function ensureDir(): void {
  if (dirReady) return;
  const dir = new Directory(Paths.document, CACHE_DIR_NAME);
  if (!dir.exists) {
    dir.create();
  }
  dirReady = true;
}

/**
 * Derive a stable filename from a URL.
 */
function urlToFilename(url: string): string {
  // Use the last path segment — spray wall photos have unique filenames
  const segment = url.split('/').pop() || 'image';
  // Strip query params
  return segment.split('?')[0];
}

/**
 * Get a local file URI for a remote image URL.
 * Downloads the image on first access, serves from disk afterwards.
 */
export async function getLocalImageUri(remoteUrl: string): Promise<string> {
  // 1. Memory cache
  const mem = memoryCache.get(remoteUrl);
  if (mem) return mem;

  // 2. Dedup in-flight downloads
  const existing = inFlight.get(remoteUrl);
  if (existing) return existing;

  const promise = resolveLocalUri(remoteUrl);
  inFlight.set(remoteUrl, promise);

  try {
    return await promise;
  } finally {
    inFlight.delete(remoteUrl);
  }
}

async function resolveLocalUri(remoteUrl: string): Promise<string> {
  ensureDir();

  const filename = urlToFilename(remoteUrl);
  const file = new File(Paths.document, CACHE_DIR_NAME, filename);

  // 3. Check disk
  if (file.exists && file.size && file.size > 0) {
    memoryCache.set(remoteUrl, file.uri);
    return file.uri;
  }

  // 4. Download
  const dir = new Directory(Paths.document, CACHE_DIR_NAME);
  const output = await File.downloadFileAsync(remoteUrl, dir);

  if (!output.exists) {
    throw new Error(`Download failed for ${remoteUrl}`);
  }

  // downloadFileAsync may name the file differently; rename to our expected name
  const expectedUri = file.uri;
  if (output.uri !== expectedUri) {
    const target = new File(Paths.document, CACHE_DIR_NAME, filename);
    output.move(target);
    memoryCache.set(remoteUrl, target.uri);
    return target.uri;
  }

  memoryCache.set(remoteUrl, output.uri);
  return output.uri;
}

/**
 * Remove a cached image (e.g., when a photo is replaced).
 */
export function invalidateImage(remoteUrl: string): void {
  memoryCache.delete(remoteUrl);
  const filename = urlToFilename(remoteUrl);
  const file = new File(Paths.document, CACHE_DIR_NAME, filename);
  try { file.delete(); } catch {}
}

/** Exposed for testing */
export function _clearMemoryCache(): void {
  memoryCache.clear();
  dirReady = false;
}
