import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";

// Mock cacheEvents before importing the hook
const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock("../../lib/api", () => ({
  cacheEvents: {
    subscribe: (...args: any[]) => {
      mockSubscribe(...args);
      return mockUnsubscribe;
    },
  },
}));

import { usePaginatedQuery } from "../../hooks/usePaginatedQuery";

// Minimal renderHook using react-test-renderer
function renderHook<T>(hookFn: () => T) {
  let result: { current: T } = {} as any;
  let renderer: ReactTestRenderer;

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  act(() => {
    renderer = create(React.createElement(TestComponent));
  });

  return {
    result,
    unmount: () => act(() => renderer!.unmount()),
    rerender: () =>
      act(() => renderer!.update(React.createElement(TestComponent))),
  };
}

const flushPromises = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

type Item = { id: string; created_at: string };
const getCursor = (items: Item[]) => {
  const last = items[items.length - 1];
  return { created_at: last.created_at, id: last.id };
};

describe("usePaginatedQuery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches initial page and sets data", async () => {
    const items = [{ id: "1", created_at: "2024-01-01" }];
    const fetcher = jest
      .fn()
      .mockResolvedValue({ data: items, hasMore: false });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, [], { getCursor }),
    );

    await flushPromises();

    expect(fetcher).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(items);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("loads more and appends data", async () => {
    const page1 = [{ id: "1", created_at: "2024-01-02" }];
    const page2 = [{ id: "2", created_at: "2024-01-01" }];
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ data: page1, hasMore: true })
      .mockResolvedValueOnce({ data: page2, hasMore: false });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, [], { getCursor }),
    );

    await flushPromises();
    expect(result.current.data).toEqual(page1);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      result.current.loadMore();
    });
    await flushPromises();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith({
      created_at: "2024-01-02",
      id: "1",
    });
    expect(result.current.data).toEqual([...page1, ...page2]);
    expect(result.current.hasMore).toBe(false);
  });

  it("guards loadMore when already loading more", async () => {
    let resolveSecond: (v: any) => void;
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: "1", created_at: "2024-01-01" }],
        hasMore: true,
      })
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveSecond = r;
          }),
      );

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, [], { getCursor }),
    );

    await flushPromises();

    // Start loadMore
    act(() => {
      result.current.loadMore();
    });

    // Try again while still loading — should be guarded
    act(() => {
      result.current.loadMore();
    });

    expect(fetcher).toHaveBeenCalledTimes(2); // Only initial + one loadMore

    // Resolve to clean up
    await act(async () => {
      resolveSecond!({ data: [], hasMore: false });
    });
  });

  it("guards loadMore when hasMore is false", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue({
        data: [{ id: "1", created_at: "2024-01-01" }],
        hasMore: false,
      });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, [], { getCursor }),
    );

    await flushPromises();

    act(() => {
      result.current.loadMore();
    });
    await flushPromises();

    expect(fetcher).toHaveBeenCalledTimes(1); // Only initial, no loadMore
  });

  it("refresh resets to first page", async () => {
    const page1 = [{ id: "1", created_at: "2024-01-02" }];
    const page2 = [{ id: "2", created_at: "2024-01-01" }];
    const refreshed = [{ id: "3", created_at: "2024-01-03" }];
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ data: page1, hasMore: true })
      .mockResolvedValueOnce({ data: page2, hasMore: false })
      .mockResolvedValueOnce({ data: refreshed, hasMore: false });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, [], { getCursor }),
    );

    await flushPromises();

    await act(async () => {
      result.current.loadMore();
    });
    await flushPromises();
    expect(result.current.data).toEqual([...page1, ...page2]);

    await act(async () => {
      result.current.refresh();
    });
    await flushPromises();

    // Data replaced, not appended
    expect(result.current.data).toEqual(refreshed);
    expect(fetcher).toHaveBeenLastCalledWith(undefined); // No cursor on refresh
  });

  it("subscribes to cache events and resets on invalidation", async () => {
    const page1 = [{ id: "1", created_at: "2024-01-01" }];
    const refreshed = [{ id: "2", created_at: "2024-01-02" }];
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ data: page1, hasMore: false })
      .mockResolvedValueOnce({ data: refreshed, hasMore: false });

    renderHook(() =>
      usePaginatedQuery(fetcher, [], { cacheKey: ["routes"], getCursor }),
    );

    await flushPromises();

    expect(mockSubscribe).toHaveBeenCalledWith("routes", expect.any(Function));

    // Simulate cache invalidation
    const invalidationCallback = mockSubscribe.mock.calls[0][1];
    await act(async () => {
      invalidationCallback();
    });
    await flushPromises();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(undefined); // Reset cursor
  });

  it("handles fetch errors", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("network fail"));

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, [], { getCursor }),
    );

    await flushPromises();

    expect(result.current.error).toBe("network fail");
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual([]);
  });

  it("does not refetch when deps change by reference but not value", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({
        data: [{ id: "1", created_at: "2024-01-01" }],
        hasMore: false,
      })
      .mockResolvedValueOnce({
        data: [{ id: "2", created_at: "2024-01-02" }],
        hasMore: false,
      });

    // Use a mutable ref so the wrapper component can receive new deps on rerender
    const depsRef = { current: [{ id: 1 }] as any[] };
    let renderer: ReactTestRenderer;

    function TestComponent() {
      usePaginatedQuery(fetcher, depsRef.current, { getCursor });
      return null;
    }

    act(() => {
      renderer = create(React.createElement(TestComponent));
    });

    await flushPromises();

    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockClear();

    // Update the ref to a new object with the same value, then rerender
    depsRef.current = [{ id: 1 }];
    await act(async () => {
      renderer!.update(React.createElement(TestComponent));
    });

    await flushPromises();

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("discards stale responses via fetchIdRef", async () => {
    let resolveFirst: (v: any) => void;
    const fetcher = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            resolveFirst = r;
          }),
      )
      .mockResolvedValueOnce({
        data: [{ id: "fresh", created_at: "2024-01-01" }],
        hasMore: false,
      });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, [], { getCursor }),
    );

    // Trigger refresh before first fetch resolves
    await act(async () => {
      result.current.refresh();
    });
    await flushPromises();

    // Now resolve the stale first fetch
    await act(async () => {
      resolveFirst!({
        data: [{ id: "stale", created_at: "2024-01-01" }],
        hasMore: false,
      });
    });
    await flushPromises();

    // Should have the fresh data, not stale
    expect(result.current.data[0].id).toBe("fresh");
  });
});
