import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

// Mock cacheEvents before importing the hook
const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();

jest.mock('../../lib/api', () => ({
  cacheEvents: {
    subscribe: (...args: any[]) => {
      mockSubscribe(...args);
      return mockUnsubscribe;
    },
  },
}));

import { useApiQuery } from '../../hooks/useApiQuery';

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
    rerender: () => act(() => renderer!.update(React.createElement(TestComponent))),
  };
}

// Helper to flush promises
const flushPromises = () => act(async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
});

describe('useApiQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches data on mount and transitions loading', async () => {
    const fetcher = jest.fn().mockResolvedValue({ id: 1, name: 'test' });

    const { result } = renderHook(() => useApiQuery(fetcher, []));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await flushPromises();

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ id: 1, name: 'test' });
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('uses initialData when provided', async () => {
    const fetcher = jest.fn().mockResolvedValue(['fetched']);

    const { result } = renderHook(() =>
      useApiQuery(fetcher, [], { initialData: ['initial'] }),
    );

    expect(result.current.data).toEqual(['initial']);

    await flushPromises();

    expect(result.current.data).toEqual(['fetched']);
  });

  it('subscribes to cache events when cacheKey is provided', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');

    renderHook(() =>
      useApiQuery(fetcher, [], { cacheKey: 'routes' }),
    );

    await flushPromises();

    expect(mockSubscribe).toHaveBeenCalledWith('routes', expect.any(Function));
  });

  it('subscribes to multiple cache keys', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');

    renderHook(() =>
      useApiQuery(fetcher, [], { cacheKey: ['routes', 'sends'] }),
    );

    await flushPromises();

    expect(mockSubscribe).toHaveBeenCalledWith('routes', expect.any(Function));
    expect(mockSubscribe).toHaveBeenCalledWith('sends', expect.any(Function));
  });

  it('does not subscribe when no cacheKey', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');

    renderHook(() => useApiQuery(fetcher, []));

    await flushPromises();

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('skips fetch and sets loading=false when enabled=false', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');

    const { result } = renderHook(() =>
      useApiQuery(fetcher, [], { enabled: false }),
    );

    await flushPromises();

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('does not subscribe to cache events when enabled=false', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');

    renderHook(() =>
      useApiQuery(fetcher, [], { enabled: false, cacheKey: 'routes' }),
    );

    await flushPromises();

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('handles errors and sets error state', async () => {
    const error = new Error('Network error');
    const fetcher = jest.fn().mockRejectedValue(error);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useApiQuery(fetcher, []));

    await flushPromises();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();

    consoleSpy.mockRestore();
  });

  it('handles non-Error thrown values', async () => {
    const fetcher = jest.fn().mockRejectedValue('string error');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useApiQuery(fetcher, []));

    await flushPromises();

    expect(result.current.error).toBe('An error occurred');

    consoleSpy.mockRestore();
  });

  it('unsubscribes from cache events on unmount', async () => {
    const fetcher = jest.fn().mockResolvedValue('data');

    const { unmount } = renderHook(() =>
      useApiQuery(fetcher, [], { cacheKey: 'routes' }),
    );

    await flushPromises();

    expect(mockSubscribe).toHaveBeenCalled();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('cache invalidation triggers refetch', async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');

    renderHook(() =>
      useApiQuery(fetcher, [], { cacheKey: 'routes' }),
    );

    await flushPromises();

    // Get the callback passed to subscribe
    const cacheCallback = mockSubscribe.mock.calls[0][1];

    // Simulate cache invalidation
    await act(async () => {
      cacheCallback();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('refresh sets refreshing=true then back to false', async () => {
    let resolvePromise: (value: string) => void;
    const fetcher = jest.fn().mockImplementation(
      () => new Promise<string>(resolve => { resolvePromise = resolve; }),
    );

    const { result } = renderHook(() => useApiQuery(fetcher, []));

    // Resolve initial fetch
    await act(async () => { resolvePromise!('first'); });

    expect(result.current.refreshing).toBe(false);

    // Call refresh
    const refreshPromise = new Promise<string>(resolve => {
      fetcher.mockImplementation(() => new Promise<string>(r => { resolvePromise = r; resolve('started'); }));
    });

    act(() => { result.current.refresh(); });
    await refreshPromise;

    expect(result.current.refreshing).toBe(true);

    // Resolve refresh
    await act(async () => { resolvePromise!('second'); });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.data).toBe('second');
  });

  it('clears error before each fetch', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const fetcher = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('success');

    const { result } = renderHook(() =>
      useApiQuery(fetcher, [], { cacheKey: 'routes' }),
    );

    await flushPromises();
    expect(result.current.error).toBe('fail');

    // Trigger refetch via cache
    const cacheCallback = mockSubscribe.mock.calls[0][1];
    await act(async () => {
      cacheCallback();
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe('success');

    consoleSpy.mockRestore();
  });
});
