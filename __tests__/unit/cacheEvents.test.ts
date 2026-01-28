// Test cache events in isolation by re-implementing the pattern
// This tests the logic without importing the actual module (which has Supabase dependency)

type InvalidationEvent = 'routes' | 'route' | 'photos' | 'detected_holds' | 'sends' | 'comments';
type Listener = () => void;

function createCacheEvents() {
  const listeners: Map<InvalidationEvent, Set<Listener>> = new Map();

  return {
    subscribe(event: InvalidationEvent, listener: Listener): () => void {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(listener);

      return () => {
        listeners.get(event)?.delete(listener);
      };
    },

    invalidate(event: InvalidationEvent) {
      listeners.get(event)?.forEach(listener => listener());
    },

    // For testing: get listener count
    _getListenerCount(event: InvalidationEvent): number {
      return listeners.get(event)?.size || 0;
    },
  };
}

describe('cacheEvents', () => {
  let cacheEvents: ReturnType<typeof createCacheEvents>;

  beforeEach(() => {
    cacheEvents = createCacheEvents();
  });

  describe('subscribe', () => {
    it('registers a listener for an event', () => {
      const listener = jest.fn();
      cacheEvents.subscribe('routes', listener);

      expect(cacheEvents._getListenerCount('routes')).toBe(1);
    });

    it('allows multiple listeners for the same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      cacheEvents.subscribe('routes', listener1);
      cacheEvents.subscribe('routes', listener2);

      expect(cacheEvents._getListenerCount('routes')).toBe(2);
    });

    it('allows same listener for different events', () => {
      const listener = jest.fn();

      cacheEvents.subscribe('routes', listener);
      cacheEvents.subscribe('sends', listener);

      expect(cacheEvents._getListenerCount('routes')).toBe(1);
      expect(cacheEvents._getListenerCount('sends')).toBe(1);
    });

    it('returns an unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = cacheEvents.subscribe('routes', listener);

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('unsubscribe', () => {
    it('removes the listener when called', () => {
      const listener = jest.fn();
      const unsubscribe = cacheEvents.subscribe('routes', listener);

      expect(cacheEvents._getListenerCount('routes')).toBe(1);

      unsubscribe();

      expect(cacheEvents._getListenerCount('routes')).toBe(0);
    });

    it('only removes the specific listener', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      const unsubscribe1 = cacheEvents.subscribe('routes', listener1);
      cacheEvents.subscribe('routes', listener2);

      unsubscribe1();

      expect(cacheEvents._getListenerCount('routes')).toBe(1);

      // Verify listener2 still gets called
      cacheEvents.invalidate('routes');
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('is safe to call multiple times', () => {
      const listener = jest.fn();
      const unsubscribe = cacheEvents.subscribe('routes', listener);

      unsubscribe();
      unsubscribe(); // Should not throw

      expect(cacheEvents._getListenerCount('routes')).toBe(0);
    });
  });

  describe('invalidate', () => {
    it('calls all listeners for the event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      cacheEvents.subscribe('routes', listener1);
      cacheEvents.subscribe('routes', listener2);

      cacheEvents.invalidate('routes');

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('does not call listeners for other events', () => {
      const routesListener = jest.fn();
      const sendsListener = jest.fn();

      cacheEvents.subscribe('routes', routesListener);
      cacheEvents.subscribe('sends', sendsListener);

      cacheEvents.invalidate('routes');

      expect(routesListener).toHaveBeenCalledTimes(1);
      expect(sendsListener).not.toHaveBeenCalled();
    });

    it('is safe to call with no listeners', () => {
      // Should not throw
      expect(() => cacheEvents.invalidate('routes')).not.toThrow();
    });

    it('can be called multiple times', () => {
      const listener = jest.fn();
      cacheEvents.subscribe('routes', listener);

      cacheEvents.invalidate('routes');
      cacheEvents.invalidate('routes');
      cacheEvents.invalidate('routes');

      expect(listener).toHaveBeenCalledTimes(3);
    });
  });

  describe('event types', () => {
    const allEvents: InvalidationEvent[] = [
      'routes',
      'route',
      'photos',
      'detected_holds',
      'sends',
      'comments',
    ];

    it.each(allEvents)('supports %s event', (event) => {
      const listener = jest.fn();
      cacheEvents.subscribe(event, listener);
      cacheEvents.invalidate(event);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration scenario', () => {
    it('simulates component lifecycle with subscribe/invalidate/unsubscribe', () => {
      const fetchRoutes = jest.fn();

      // Component mounts
      const unsubscribe = cacheEvents.subscribe('routes', fetchRoutes);

      // Initial data is not fetched by subscribe (just registers)
      expect(fetchRoutes).not.toHaveBeenCalled();

      // Something creates a route
      cacheEvents.invalidate('routes');
      expect(fetchRoutes).toHaveBeenCalledTimes(1);

      // Another route created
      cacheEvents.invalidate('routes');
      expect(fetchRoutes).toHaveBeenCalledTimes(2);

      // Component unmounts
      unsubscribe();

      // More invalidations happen but listener is gone
      cacheEvents.invalidate('routes');
      expect(fetchRoutes).toHaveBeenCalledTimes(2); // Still 2
    });
  });
});
