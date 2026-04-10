import { useState, useEffect, useCallback, useRef } from "react";
import { cacheEvents } from "../lib/api";

type UsePaginatedQueryOptions<T, C> = {
  cacheKey?: string | string[];
  getCursor: (items: T[]) => C;
};

type UsePaginatedQueryResult<T> = {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  refreshing: boolean;
  hasMore: boolean;
  refresh: () => void;
  loadMore: () => void;
};

export function usePaginatedQuery<T, C>(
  fetcher: (cursor?: C) => Promise<{ data: T[]; hasMore: boolean }>,
  deps: React.DependencyList,
  options: UsePaginatedQueryOptions<T, C>,
): UsePaginatedQueryResult<T> {
  const { cacheKey, getCursor } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);
  const cursorRef = useRef<C | undefined>(undefined);
  const getCursorRef = useRef(getCursor);
  getCursorRef.current = getCursor;

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const depsKey = JSON.stringify(deps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFetcher = useCallback(
    (cursor?: C) => fetcherRef.current(cursor),
    [depsKey],
  );

  const fetchPage = useCallback(
    async (mode: "initial" | "refresh" | "more" | "silent") => {
      const fetchId = ++fetchIdRef.current;

      if (mode === "initial") {
        cursorRef.current = undefined;
        setLoading(true);
      } else if (mode === "refresh") {
        cursorRef.current = undefined;
        setRefreshing(true);
      } else if (mode === "more") {
        setLoadingMore(true);
      } else if (mode === "silent") {
        cursorRef.current = undefined;
      }

      setError(null);

      try {
        const cursor = mode === "more" ? cursorRef.current : undefined;
        const result = await stableFetcher(cursor);

        if (mountedRef.current && fetchId === fetchIdRef.current) {
          if (mode === "more") {
            setData((prev) => [...prev, ...result.data]);
          } else {
            setData(result.data);
          }
          setHasMore(result.hasMore);
          cursorRef.current =
            result.data.length > 0
              ? getCursorRef.current(result.data)
              : undefined;
        }
      } catch (err) {
        console.error("usePaginatedQuery error:", err);
        if (mountedRef.current && fetchId === fetchIdRef.current) {
          setError(err instanceof Error ? err.message : "An error occurred");
        }
      } finally {
        if (mountedRef.current && fetchId === fetchIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [stableFetcher],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Initial fetch + refetch on dep change
  useEffect(() => {
    fetchPage("initial");
  }, [fetchPage]);

  // Cache subscription
  const cacheKeyStr = Array.isArray(cacheKey) ? cacheKey.join(",") : cacheKey;
  useEffect(() => {
    if (!cacheKey) return;

    const keys = Array.isArray(cacheKey) ? cacheKey : [cacheKey];
    const unsubscribes = keys.map((key) =>
      cacheEvents.subscribe(key as any, () => fetchPage("silent")),
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKeyStr, fetchPage]);

  const refresh = useCallback(() => {
    fetchPage("refresh");
  }, [fetchPage]);
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    fetchPage("more");
  }, [fetchPage, loadingMore, hasMore, loading]);

  return {
    data,
    loading,
    loadingMore,
    error,
    refreshing,
    hasMore,
    refresh,
    loadMore,
  };
}
