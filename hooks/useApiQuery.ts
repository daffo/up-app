import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheEvents } from '../lib/api';

type UseApiQueryOptions<T> = {
  /** Cache event key(s) to subscribe to for auto-refetch. Omit for one-off fetches. */
  cacheKey?: string | string[];
  /** If false, skip the fetch (for conditional loading). Default: true. */
  enabled?: boolean;
  /** Initial data value. Default: null. */
  initialData?: T;
};

type UseApiQueryResult<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  /** Call to trigger pull-to-refresh (sets refreshing=true, then refetches). */
  refresh: () => void;
  /** Call to manually refetch without showing refreshing state. */
  refetch: () => void;
};

// When initialData is provided, data is never null
export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
  options: UseApiQueryOptions<T> & { initialData: T },
): UseApiQueryResult<T>;
// When initialData is omitted, data can be null
export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
  options?: UseApiQueryOptions<T>,
): UseApiQueryResult<T | null>;
export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList,
  options?: UseApiQueryOptions<T>,
): UseApiQueryResult<T | null> {
  const { cacheKey, enabled = true, initialData } = options ?? {};

  const [data, setData] = useState<T | null>((initialData ?? null) as T | null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFetcher = useCallback(fetcher, deps);

  const fetchData = useCallback(async (isRefresh = false) => {
    const fetchId = ++fetchIdRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await stableFetcher();
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setData(result);
      }
    } catch (err) {
      console.error('useApiQuery error:', err);
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [stableFetcher]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Main fetch effect
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [enabled, fetchData]);

  // Cache subscription — serialize cacheKey for stable deps
  const cacheKeyStr = Array.isArray(cacheKey) ? cacheKey.join(',') : cacheKey;
  useEffect(() => {
    if (!enabled || !cacheKey) return;

    const keys = Array.isArray(cacheKey) ? cacheKey : [cacheKey];
    const unsubscribes = keys.map(key =>
      cacheEvents.subscribe(key as any, () => fetchData()),
    );

    return () => { unsubscribes.forEach(unsub => unsub()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cacheKeyStr, fetchData]);

  const refresh = useCallback(() => { fetchData(true); }, [fetchData]);
  const refetch = useCallback(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refreshing, refresh, refetch } as any;
}
