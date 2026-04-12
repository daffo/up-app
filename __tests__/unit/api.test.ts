import { supabase } from '../../lib/supabase';
import {
  cacheEvents,
  routesApi,
  photosApi,
  detectedHoldsApi,
  userProfilesApi,
  enrichWithDisplayNames,
  sendsApi,
  commentsApi,
  accountApi,
  validateCursor,
  sanitizeFilterValue,
} from '../../lib/api';

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('expo-image', () => ({
  Image: { prefetch: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../lib/cache/detected-holds-cache', () => ({
  getCachedHolds: jest.fn().mockResolvedValue(null),
  getCachedHoldsAnyVersion: jest.fn().mockResolvedValue(null),
  getCachedVersion: jest.fn().mockResolvedValue(null),
  setCachedHolds: jest.fn().mockResolvedValue(undefined),
  invalidateHoldsCache: jest.fn().mockResolvedValue(undefined),
}));

const mockFrom = supabase.from as jest.Mock;

/**
 * Creates a chainable Supabase query builder mock.
 * Calling `await builder` resolves to `resolvedValue`.
 */
function createBuilder(resolvedValue: { data: any; error: any }) {
  const builder: any = {};
  const methods = [
    'select', 'eq', 'in', 'not', 'is', 'or', 'ilike', 'order', 'limit', 'lt',
    'insert', 'update', 'upsert', 'delete', 'single', 'maybeSingle',
  ];
  for (const m of methods) {
    builder[m] = jest.fn().mockReturnValue(builder);
  }
  // Make the builder thenable so `await builder` resolves
  builder.then = (resolve: any) => resolve(resolvedValue);
  return builder;
}

// Track unsubscribe functions to clean up after each test
const unsubs: Array<() => void> = [];

afterEach(() => {
  unsubs.forEach(fn => fn());
  unsubs.length = 0;
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// validateCursor
// ---------------------------------------------------------------------------
describe('validateCursor', () => {
  it('accepts a valid UUID and ISO timestamp', () => {
    expect(() =>
      validateCursor({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        created_at: '2024-06-15T12:00:00Z',
      }),
    ).not.toThrow();
  });

  it('accepts ISO timestamp with fractional seconds', () => {
    expect(() =>
      validateCursor({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        created_at: '2024-06-15T12:00:00.123Z',
      }),
    ).not.toThrow();
  });

  it('accepts ISO timestamp with timezone offset', () => {
    expect(() =>
      validateCursor({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        created_at: '2024-06-15T12:00:00+02:00',
      }),
    ).not.toThrow();
  });

  it('rejects non-UUID id', () => {
    expect(() =>
      validateCursor({
        id: 'not-a-uuid',
        created_at: '2024-06-15T12:00:00Z',
      }),
    ).toThrow('Invalid cursor: id must be a valid UUID');
  });

  it('rejects id with SQL/operator injection payload', () => {
    expect(() =>
      validateCursor({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890),or(1=1',
        created_at: '2024-06-15T12:00:00Z',
      }),
    ).toThrow('Invalid cursor: id must be a valid UUID');
  });

  it('rejects non-ISO timestamp', () => {
    expect(() =>
      validateCursor({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        created_at: 'not-a-date',
      }),
    ).toThrow('Invalid cursor: created_at must be a valid ISO 8601 timestamp');
  });

  it('rejects timestamp with operator injection payload', () => {
    expect(() =>
      validateCursor({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        created_at: '2024-01-01,id.gt.0',
      }),
    ).toThrow('Invalid cursor: created_at must be a valid ISO 8601 timestamp');
  });

  it('rejects empty strings', () => {
    expect(() =>
      validateCursor({ id: '', created_at: '' }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// sanitizeFilterValue
// ---------------------------------------------------------------------------
describe('sanitizeFilterValue', () => {
  it('returns normal text unchanged', () => {
    expect(sanitizeFilterValue('Cool Route')).toBe('Cool Route');
  });

  it('escapes commas to prevent multi-filter injection', () => {
    expect(sanitizeFilterValue('a,b')).toBe('a\\,b');
  });

  it('escapes dots to prevent operator injection', () => {
    expect(sanitizeFilterValue('title.ilike.%hack%')).toBe('title\\.ilike\\.%hack%');
  });

  it('escapes parentheses to prevent grouping injection', () => {
    expect(sanitizeFilterValue('V5).or(1=1')).toBe('V5\\)\\.or\\(1=1');
  });

  it('escapes backslashes', () => {
    expect(sanitizeFilterValue('test\\value')).toBe('test\\\\value');
  });

  it('handles combined injection payload', () => {
    // Simulates: search = "x%,description.ilike.%,title.eq.hacked"
    const malicious = 'x%,description.ilike.%,title.eq.hacked';
    const result = sanitizeFilterValue(malicious);
    // Commas and dots are escaped — PostgREST will not interpret them as operators
    expect(result).not.toMatch(/(?<!\\),/);
    expect(result).toBe('x%\\,description\\.ilike\\.%\\,title\\.eq\\.hacked');
  });
});

// ---------------------------------------------------------------------------
// cacheEvents
// ---------------------------------------------------------------------------
describe('cacheEvents', () => {
  it('subscribe registers listener and returns unsubscribe', () => {
    const listener = jest.fn();
    const unsub = cacheEvents.subscribe('routes', listener);
    unsubs.push(unsub);

    cacheEvents.invalidate('routes');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('invalidate calls all listeners for the event', () => {
    const a = jest.fn();
    const b = jest.fn();
    unsubs.push(cacheEvents.subscribe('routes', a));
    unsubs.push(cacheEvents.subscribe('routes', b));

    cacheEvents.invalidate('routes');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('invalidate does not call listeners for other events', () => {
    const routesFn = jest.fn();
    const sendsFn = jest.fn();
    unsubs.push(cacheEvents.subscribe('routes', routesFn));
    unsubs.push(cacheEvents.subscribe('sends', sendsFn));

    cacheEvents.invalidate('routes');
    expect(routesFn).toHaveBeenCalledTimes(1);
    expect(sendsFn).not.toHaveBeenCalled();
  });

  it('unsubscribe removes the listener', () => {
    const listener = jest.fn();
    const unsub = cacheEvents.subscribe('routes', listener);
    unsub();

    cacheEvents.invalidate('routes');
    expect(listener).not.toHaveBeenCalled();
  });

  it('invalidate is safe with no listeners', () => {
    expect(() => cacheEvents.invalidate('comments')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// routesApi
// ---------------------------------------------------------------------------
describe('routesApi', () => {
  // -- list --
  describe('list', () => {
    it('maps server-computed avg_rating and send_count', async () => {
      const builder = createBuilder({
        data: [{
          id: 'r1', title: 'Route 1', avg_rating: 3, send_count: 2, photo: {},
        }],
        error: null,
      });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.list();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].avgRating).toBe(3);
      expect(result.data[0].sendCount).toBe(2);
    });

    it('returns null avgRating when server returns null', async () => {
      const builder = createBuilder({
        data: [{
          id: 'r1', avg_rating: null, send_count: 1, photo: {},
        }],
        error: null,
      });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.list();
      expect(result.data[0].avgRating).toBeNull();
      expect(result.data[0].sendCount).toBe(1);
    });

    it('defaults to active wall filter', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list();
      expect(builder.not).toHaveBeenCalledWith('photo.setup_date', 'is', null);
      expect(builder.is).toHaveBeenCalledWith('photo.teardown_date', null);
    });

    it('applies past wall filter', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list({ wallStatus: 'past' });
      expect(builder.not).toHaveBeenCalledWith('photo.teardown_date', 'is', null);
    });

    it('applies all wall filter', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list({ wallStatus: 'all' });
      expect(builder.not).toHaveBeenCalledWith('photo.setup_date', 'is', null);
      // Should NOT call .is for teardown_date
      expect(builder.is).not.toHaveBeenCalled();
    });

    it('applies creatorId filter', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list({ creatorId: 'u1' });
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    });

    it('applies grade filter', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list({ grade: 'V5' });
      expect(builder.ilike).toHaveBeenCalledWith('grade', '%V5%');
    });

    it('applies search filter', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list({ search: 'cool' });
      expect(builder.or).toHaveBeenCalledWith(
        'title.ilike.%cool%,description.ilike.%cool%',
      );
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(routesApi.list()).rejects.toEqual({ message: 'fail' });
    });

    it('returns empty data when data is null', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.list();
      expect(result.data).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('sets hasMore true when more results than pageSize', async () => {
      // 21 items returned for default pageSize of 20 → hasMore = true
      const items = Array.from({ length: 21 }, (_, i) => ({
        id: `r${i}`, created_at: `2024-01-${String(i + 1).padStart(2, '0')}`,
        avg_rating: null, send_count: 0, photo: {},
      }));
      const builder = createBuilder({ data: items, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.list();
      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
    });

    it('sets hasMore false when results fit in page', async () => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `r${i}`, avg_rating: null, send_count: 0, photo: {},
      }));
      const builder = createBuilder({ data: items, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.list();
      expect(result.data).toHaveLength(5);
      expect(result.hasMore).toBe(false);
    });

    it('applies cursor filter with tiebreaker', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list(undefined, {
        cursor: { created_at: '2024-06-15T12:00:00Z', id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      });
      expect(builder.or).toHaveBeenCalledWith(
        'created_at.lt.2024-06-15T12:00:00Z,and(created_at.eq.2024-06-15T12:00:00Z,id.lt.a1b2c3d4-e5f6-7890-abcd-ef1234567890)',
      );
    });

    it('applies limit based on pageSize', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list(undefined, { pageSize: 5 });
      expect(builder.limit).toHaveBeenCalledWith(6);
    });

    // -- SQL injection prevention --

    it('escapes % and _ wildcards in grade filter', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list({ grade: 'V5%_drop' });
      expect(builder.ilike).toHaveBeenCalledWith('grade', '%V5\\%\\_drop%');
    });

    it('sanitizes search input to prevent PostgREST operator injection', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      // Attacker tries to inject a second filter via comma and .ilike. operator
      await routesApi.list({ search: 'x,description.ilike.%hack%' });
      const orCall = builder.or.mock.calls[0][0] as string;
      // The comma and dots must be escaped so PostgREST treats them as literals
      expect(orCall).not.toContain(',description.ilike.%hack%');
      expect(orCall).toContain('x\\,description\\.ilike\\.%hack%');
    });

    it('sanitizes search with parentheses injection', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list({ search: 'V5).or(1=1' });
      const orCall = builder.or.mock.calls[0][0] as string;
      expect(orCall).toContain('V5\\)\\.or\\(1=1');
    });

    it('throws on malformed cursor with non-UUID id', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await expect(
        routesApi.list(undefined, {
          cursor: { created_at: '2024-06-15T12:00:00Z', id: 'not-a-uuid' },
        }),
      ).rejects.toThrow('Invalid cursor: id must be a valid UUID');
    });

    it('throws on malformed cursor with non-ISO timestamp', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await expect(
        routesApi.list(undefined, {
          cursor: {
            created_at: '2024-01-01,id.gt.00000000-0000-0000-0000-000000000000',
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          },
        }),
      ).rejects.toThrow('Invalid cursor: created_at must be a valid ISO 8601 timestamp');
    });

    it('accepts valid cursor and passes it to query', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      const validCursor = {
        created_at: '2024-06-15T12:00:00Z',
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      };
      await routesApi.list(undefined, { cursor: validCursor });
      expect(builder.or).toHaveBeenCalledWith(
        `created_at.lt.${validCursor.created_at},and(created_at.eq.${validCursor.created_at},id.lt.${validCursor.id})`,
      );
    });

    it('normal grade filter still works after sanitization', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list({ grade: 'V5' });
      expect(builder.ilike).toHaveBeenCalledWith('grade', '%V5%');
    });

    it('normal search filter still works after sanitization', async () => {
      const builder = createBuilder({ data: [], error: null });
      mockFrom.mockReturnValue(builder);

      await routesApi.list({ search: 'cool route' });
      expect(builder.or).toHaveBeenCalledWith(
        'title.ilike.%cool route%,description.ilike.%cool route%',
      );
    });
  });

  // -- listByPhoto --
  describe('listByPhoto', () => {
    it('returns filtered routes', async () => {
      const builder = createBuilder({ data: [{ id: 'r1' }], error: null });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.listByPhoto('p1');
      expect(result).toEqual([{ id: 'r1' }]);
      expect(builder.eq).toHaveBeenCalledWith('photo_id', 'p1');
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(routesApi.listByPhoto('p1')).rejects.toEqual({ message: 'fail' });
    });
  });

  // -- get --
  describe('get', () => {
    it('returns route with photo join', async () => {
      const builder = createBuilder({ data: { id: 'r1', photo: { id: 'p1' } }, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.get('r1');
      expect(result).toEqual({ id: 'r1', photo: { id: 'p1' } });
      expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
      expect(builder.maybeSingle).toHaveBeenCalled();
    });

    it('returns null when route not found', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.get('r1');
      expect(result).toBeNull();
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(routesApi.get('r1')).rejects.toEqual({ message: 'fail' });
    });
  });

  // -- create --
  describe('create', () => {
    it('inserts and invalidates routes', async () => {
      const builder = createBuilder({ data: { id: 'r1' }, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('routes', listener));

      const input = {
        title: 'T', description: null, grade: 'V3',
        photo_id: 'p1', holds: { hand_holds: [], foot_holds: [] }, user_id: 'u1',
      };
      const result = await routesApi.create(input);

      expect(result).toEqual({ id: 'r1' });
      expect(builder.insert).toHaveBeenCalledWith(input);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(routesApi.create({
        title: 'T', description: null, grade: 'V3',
        photo_id: 'p1', holds: { hand_holds: [], foot_holds: [] }, user_id: 'u1',
      })).rejects.toEqual({ message: 'fail' });
    });
  });

  // -- update --
  describe('update', () => {
    it('updates and invalidates routes AND route', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const routesListener = jest.fn();
      const routeListener = jest.fn();
      unsubs.push(cacheEvents.subscribe('routes', routesListener));
      unsubs.push(cacheEvents.subscribe('route', routeListener));

      await routesApi.update('r1', { title: 'New' });

      expect(builder.update).toHaveBeenCalledWith({ title: 'New' });
      expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
      expect(routesListener).toHaveBeenCalledTimes(1);
      expect(routeListener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(routesApi.update('r1', { title: 'X' })).rejects.toEqual({ message: 'fail' });
    });
  });

  // -- delete --
  describe('delete', () => {
    it('deletes and invalidates routes', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('routes', listener));

      await routesApi.delete('r1');

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(routesApi.delete('r1')).rejects.toEqual({ message: 'fail' });
    });
  });
});

// ---------------------------------------------------------------------------
// photosApi
// ---------------------------------------------------------------------------
describe('photosApi', () => {
  describe('listAll', () => {
    it('returns ordered photos', async () => {
      const builder = createBuilder({ data: [{ id: 'p1' }], error: null });
      mockFrom.mockReturnValue(builder);

      const result = await photosApi.listAll();
      expect(result).toEqual([{ id: 'p1' }]);
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(photosApi.listAll()).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('listActive', () => {
    it('applies date filters', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-06-01T00:00:00.000Z'));

      const builder = createBuilder({ data: [{ id: 'p1' }], error: null });
      mockFrom.mockReturnValue(builder);

      const result = await photosApi.listActive();
      expect(result).toEqual([{ id: 'p1' }]);
      expect(builder.not).toHaveBeenCalledWith('setup_date', 'is', null);
      expect(builder.or).toHaveBeenCalledWith(
        'teardown_date.is.null,teardown_date.gte.2025-06-01T00:00:00.000Z',
      );
      expect(builder.order).toHaveBeenCalledWith('setup_date', { ascending: false });

      jest.useRealTimers();
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(photosApi.listActive()).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('get', () => {
    it('returns single photo', async () => {
      const builder = createBuilder({ data: { id: 'p1' }, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await photosApi.get('p1');
      expect(result).toEqual({ id: 'p1' });
      expect(builder.eq).toHaveBeenCalledWith('id', 'p1');
      expect(builder.single).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(photosApi.get('p1')).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('update', () => {
    it('updates and invalidates photos', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('photos', listener));

      await photosApi.update('p1', { setup_date: '2025-01-01' });

      expect(builder.update).toHaveBeenCalledWith({ setup_date: '2025-01-01' });
      expect(builder.eq).toHaveBeenCalledWith('id', 'p1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(photosApi.update('p1', {})).rejects.toEqual({ message: 'fail' });
    });
  });
});

// ---------------------------------------------------------------------------
// detectedHoldsApi
// ---------------------------------------------------------------------------
describe('detectedHoldsApi', () => {
  describe('listByPhoto', () => {
    it('fetches from DB when no version and no cache', async () => {
      const builder = createBuilder({ data: [{ id: 'h1' }], error: null });
      mockFrom.mockReturnValue(builder);

      const result = await detectedHoldsApi.listByPhoto('p1');
      expect(result).toEqual([{ id: 'h1' }]);
      expect(builder.eq).toHaveBeenCalledWith('photo_id', 'p1');
    });

    it('returns any-version cached holds when no version provided', async () => {
      const { getCachedHoldsAnyVersion } = require('../../lib/cache/detected-holds-cache');
      getCachedHoldsAnyVersion.mockResolvedValueOnce([{ id: 'cached-any' }]);
      mockFrom.mockClear();

      const result = await detectedHoldsApi.listByPhoto('p1');
      expect(result).toEqual([{ id: 'cached-any' }]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('returns cached holds when version matches', async () => {
      const { getCachedHolds } = require('../../lib/cache/detected-holds-cache');
      getCachedHolds.mockResolvedValueOnce([{ id: 'cached' }]);
      mockFrom.mockClear();

      const result = await detectedHoldsApi.listByPhoto('p1', 3);
      expect(result).toEqual([{ id: 'cached' }]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('fetches and caches when version provided but cache misses', async () => {
      const { getCachedHolds, setCachedHolds } = require('../../lib/cache/detected-holds-cache');
      getCachedHolds.mockResolvedValueOnce(null);

      const builder = createBuilder({ data: [{ id: 'h1' }], error: null });
      mockFrom.mockReturnValue(builder);

      const result = await detectedHoldsApi.listByPhoto('p1', 5);
      expect(result).toEqual([{ id: 'h1' }]);
      expect(setCachedHolds).toHaveBeenCalledWith('p1', 5, [{ id: 'h1' }]);
    });

    it('bypasses cache when forceRefresh is true', async () => {
      const { getCachedHolds, getCachedHoldsAnyVersion } = require('../../lib/cache/detected-holds-cache');
      getCachedHolds.mockClear();
      getCachedHoldsAnyVersion.mockClear();

      const builder = createBuilder({ data: [{ id: 'h1' }], error: null });
      mockFrom.mockReturnValue(builder);

      const result = await detectedHoldsApi.listByPhoto('p1', 3, true);
      expect(result).toEqual([{ id: 'h1' }]);
      expect(getCachedHolds).not.toHaveBeenCalled();
      expect(getCachedHoldsAnyVersion).not.toHaveBeenCalled();
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(detectedHoldsApi.listByPhoto('p1', undefined, true)).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('update', () => {
    it('updates and invalidates detected_holds', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('detected_holds', listener));

      await detectedHoldsApi.update('h1', { dominant_color: 'red' } as any);

      expect(builder.update).toHaveBeenCalledWith({ dominant_color: 'red' });
      expect(builder.eq).toHaveBeenCalledWith('id', 'h1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(detectedHoldsApi.update('h1', {} as any)).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('create', () => {
    it('inserts and invalidates detected_holds', async () => {
      const builder = createBuilder({ data: { id: 'h1' }, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('detected_holds', listener));

      const hold = { photo_id: 'p1', polygon: [], center: { x: 50, y: 50 }, created_at: '' } as any;
      const result = await detectedHoldsApi.create(hold);

      expect(result).toEqual({ id: 'h1' });
      expect(builder.insert).toHaveBeenCalledWith(hold);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(detectedHoldsApi.create({} as any)).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('createMany', () => {
    it('returns [] for empty array without calling supabase', async () => {
      mockFrom.mockClear();
      const result = await detectedHoldsApi.createMany([]);
      expect(result).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('batch inserts and invalidates', async () => {
      const builder = createBuilder({ data: [{ id: 'h1' }, { id: 'h2' }], error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('detected_holds', listener));

      const holds = [{ photo_id: 'p1' }, { photo_id: 'p1' }] as any[];
      const result = await detectedHoldsApi.createMany(holds);

      expect(result).toEqual([{ id: 'h1' }, { id: 'h2' }]);
      expect(builder.insert).toHaveBeenCalledWith(holds);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(detectedHoldsApi.createMany([{} as any])).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('delete', () => {
    it('deletes and invalidates detected_holds', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('detected_holds', listener));

      await detectedHoldsApi.delete('h1');

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'h1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(detectedHoldsApi.delete('h1')).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('deleteByPhoto', () => {
    it('deletes by photo_id and invalidates', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('detected_holds', listener));

      await detectedHoldsApi.deleteByPhoto('p1');

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('photo_id', 'p1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(detectedHoldsApi.deleteByPhoto('p1')).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('prefetchForPhotos', () => {
    it('skips photos already cached at current version', async () => {
      const { getCachedVersion } = require('../../lib/cache/detected-holds-cache');
      getCachedVersion.mockResolvedValueOnce(5);
      mockFrom.mockClear();

      await detectedHoldsApi.prefetchForPhotos([{ id: 'p1', holds_version: 5 }]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('fetches photos with stale cache version', async () => {
      const { getCachedVersion, getCachedHolds } = require('../../lib/cache/detected-holds-cache');
      getCachedVersion.mockResolvedValueOnce(4); // stale
      getCachedHolds.mockResolvedValueOnce(null); // version mismatch

      const builder = createBuilder({ data: [{ id: 'h1' }], error: null });
      mockFrom.mockReturnValue(builder);

      await detectedHoldsApi.prefetchForPhotos([{ id: 'p1', holds_version: 5 }]);
      expect(mockFrom).toHaveBeenCalled();
    });

    it('fetches photos with no cache', async () => {
      const { getCachedVersion, getCachedHolds } = require('../../lib/cache/detected-holds-cache');
      getCachedVersion.mockResolvedValueOnce(null); // not cached
      getCachedHolds.mockResolvedValueOnce(null);

      const builder = createBuilder({ data: [{ id: 'h1' }], error: null });
      mockFrom.mockReturnValue(builder);

      await detectedHoldsApi.prefetchForPhotos([{ id: 'p1', holds_version: 3 }]);
      expect(mockFrom).toHaveBeenCalled();
    });

    it('skips photos with holds_version 0', async () => {
      const { getCachedVersion } = require('../../lib/cache/detected-holds-cache');
      getCachedVersion.mockClear();
      mockFrom.mockClear();

      await detectedHoldsApi.prefetchForPhotos([{ id: 'p1', holds_version: 0 }]);
      expect(getCachedVersion).not.toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('continues on fetch error for individual photos', async () => {
      const { getCachedVersion, getCachedHolds } = require('../../lib/cache/detected-holds-cache');
      getCachedVersion.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      getCachedHolds.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const errorBuilder = createBuilder({ data: null, error: { message: 'fail' } });
      const okBuilder = createBuilder({ data: [{ id: 'h2' }], error: null });
      mockFrom.mockReturnValueOnce(errorBuilder).mockReturnValueOnce(okBuilder);

      // Should not throw — swallows error for p1 and continues to p2
      await detectedHoldsApi.prefetchForPhotos([
        { id: 'p1', holds_version: 1 },
        { id: 'p2', holds_version: 2 },
      ]);
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });
  });
});

// ---------------------------------------------------------------------------
// userProfilesApi
// ---------------------------------------------------------------------------
describe('userProfilesApi', () => {
  beforeEach(() => {
    userProfilesApi._clearCache();
  });

  describe('get', () => {
    it('returns profile', async () => {
      const builder = createBuilder({ data: { user_id: 'u1', display_name: 'Alice' }, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await userProfilesApi.get('u1');
      expect(result).toEqual({ user_id: 'u1', display_name: 'Alice' });
    });

    it('returns null when profile not found', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await userProfilesApi.get('u1');
      expect(result).toBeNull();
    });

    it('throws on other errors', async () => {
      const builder = createBuilder({ data: null, error: { code: 'OTHER', message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(userProfilesApi.get('u1')).rejects.toEqual({ code: 'OTHER', message: 'fail' });
    });

    it('returns cached profile on second call', async () => {
      const builder = createBuilder({ data: { user_id: 'u1', display_name: 'Alice' }, error: null });
      mockFrom.mockReturnValue(builder);

      await userProfilesApi.get('u1');
      mockFrom.mockClear();

      const result = await userProfilesApi.get('u1');
      expect(result).toEqual({ user_id: 'u1', display_name: 'Alice' });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('serves cache within TTL then re-fetches after expiry', async () => {
      jest.useFakeTimers();

      const builder1 = createBuilder({ data: { user_id: 'u1', display_name: 'Alice' }, error: null });
      mockFrom.mockReturnValue(builder1);
      await userProfilesApi.get('u1');

      // Set up a new mock with updated data — cache should ignore it
      const builder2 = createBuilder({ data: { user_id: 'u1', display_name: 'Alice Updated' }, error: null });
      mockFrom.mockReturnValue(builder2);
      mockFrom.mockClear();

      // Within TTL (29 min) — should return cached value, no DB call
      jest.advanceTimersByTime(29 * 60 * 1000);
      const cached = await userProfilesApi.get('u1');
      expect(cached).toEqual({ user_id: 'u1', display_name: 'Alice' });
      expect(mockFrom).not.toHaveBeenCalled();

      // Past TTL (31 min total) — should re-fetch from DB
      jest.advanceTimersByTime(2 * 60 * 1000);
      const refreshed = await userProfilesApi.get('u1');
      expect(refreshed).toEqual({ user_id: 'u1', display_name: 'Alice Updated' });
      expect(mockFrom).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('upsert', () => {
    it('upserts with user_id', async () => {
      const builder = createBuilder({ data: { user_id: 'u1', display_name: 'Bob' }, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await userProfilesApi.upsert('u1', { display_name: 'Bob' });
      expect(result).toEqual({ user_id: 'u1', display_name: 'Bob' });
      expect(builder.upsert).toHaveBeenCalledWith({ user_id: 'u1', display_name: 'Bob' });
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(userProfilesApi.upsert('u1', { display_name: 'X' })).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('getMany', () => {
    it('returns profiles for multiple user IDs in a single query', async () => {
      const builder = createBuilder({
        data: [
          { user_id: 'u1', display_name: 'Alice' },
          { user_id: 'u2', display_name: 'Bob' },
        ],
        error: null,
      });
      mockFrom.mockReturnValue(builder);

      const result = await userProfilesApi.getMany(['u1', 'u2']);
      expect(result.size).toBe(2);
      expect(result.get('u1')).toEqual({ user_id: 'u1', display_name: 'Alice' });
      expect(result.get('u2')).toEqual({ user_id: 'u2', display_name: 'Bob' });
    });

    it('deduplicates user IDs', async () => {
      const builder = createBuilder({
        data: [
          { user_id: 'u1', display_name: 'Alice' },
          { user_id: 'u2', display_name: 'Bob' },
        ],
        error: null,
      });
      mockFrom.mockReturnValue(builder);

      await userProfilesApi.getMany(['u1', 'u1', 'u2']);
      expect(builder.in).toHaveBeenCalledWith('user_id', ['u1', 'u2']);
    });

    it('uses cache for already-fetched profiles', async () => {
      // Populate cache for u1 via get()
      const builder1 = createBuilder({ data: { user_id: 'u1', display_name: 'Alice' }, error: null });
      mockFrom.mockReturnValue(builder1);
      await userProfilesApi.get('u1');
      mockFrom.mockClear();

      // getMany with u1 (cached) and u2 (not cached)
      const builder2 = createBuilder({
        data: [{ user_id: 'u2', display_name: 'Bob' }],
        error: null,
      });
      mockFrom.mockReturnValue(builder2);

      const result = await userProfilesApi.getMany(['u1', 'u2']);
      expect(result.size).toBe(2);
      expect(result.get('u1')).toEqual({ user_id: 'u1', display_name: 'Alice' });
      // Only u2 should have been fetched
      expect(builder2.in).toHaveBeenCalledWith('user_id', ['u2']);
    });

    it('returns empty map for empty input', async () => {
      mockFrom.mockClear();
      const result = await userProfilesApi.getMany([]);
      expect(result.size).toBe(0);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('handles users with no profile (not found)', async () => {
      const builder = createBuilder({
        data: [{ user_id: 'u1', display_name: 'Alice' }],
        error: null,
      });
      mockFrom.mockReturnValue(builder);

      const result = await userProfilesApi.getMany(['u1', 'u2']);
      expect(result.size).toBe(1);
      expect(result.has('u1')).toBe(true);
      expect(result.has('u2')).toBe(false);
    });

    it('populates cache for fetched profiles', async () => {
      const builder1 = createBuilder({
        data: [{ user_id: 'u1', display_name: 'Alice' }],
        error: null,
      });
      mockFrom.mockReturnValue(builder1);

      await userProfilesApi.getMany(['u1']);
      mockFrom.mockClear();

      // get() should now return from cache
      const result = await userProfilesApi.get('u1');
      expect(result).toEqual({ user_id: 'u1', display_name: 'Alice' });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(userProfilesApi.getMany(['u1'])).rejects.toEqual({ message: 'fail' });
    });
  });
});

// ---------------------------------------------------------------------------
// enrichWithDisplayNames
// ---------------------------------------------------------------------------
describe('enrichWithDisplayNames', () => {
  beforeEach(() => {
    userProfilesApi._clearCache();
  });

  it('adds displayName to items from profiles', async () => {
    const builder = createBuilder({
      data: [{ user_id: 'u1', display_name: 'Alice' }],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const result = await enrichWithDisplayNames([
      { user_id: 'u1', id: 'item1' } as any,
    ]);
    expect(result).toEqual([
      { user_id: 'u1', id: 'item1', displayName: 'Alice' },
    ]);
  });

  it('fetches 3 unique users in a single bulk query for 5 items', async () => {
    const builder = createBuilder({
      data: [
        { user_id: 'u1', display_name: 'Alice' },
        { user_id: 'u2', display_name: 'Bob' },
        { user_id: 'u3', display_name: 'Carol' },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    mockFrom.mockClear();

    const items = [
      { user_id: 'u1', id: 'c1' },
      { user_id: 'u2', id: 'c2' },
      { user_id: 'u1', id: 'c3' },
      { user_id: 'u3', id: 'c4' },
      { user_id: 'u2', id: 'c5' },
    ] as any[];

    const result = await enrichWithDisplayNames(items);

    // Single DB call for 3 unique users, not 5 individual calls
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(builder.in).toHaveBeenCalledWith('user_id', ['u1', 'u2', 'u3']);

    // All 5 items enriched correctly
    expect(result).toHaveLength(5);
    expect(result[0].displayName).toBe('Alice');
    expect(result[1].displayName).toBe('Bob');
    expect(result[2].displayName).toBe('Alice');
    expect(result[3].displayName).toBe('Carol');
    expect(result[4].displayName).toBe('Bob');
  });

  it('sets displayName to undefined when profile not found', async () => {
    const builder = createBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    const result = await enrichWithDisplayNames([
      { user_id: 'u1', id: 'item1' } as any,
    ]);
    expect(result[0].displayName).toBeUndefined();
  });

  it('handles empty array', async () => {
    const result = await enrichWithDisplayNames([]);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// sendsApi
// ---------------------------------------------------------------------------
describe('sendsApi', () => {
  describe('listByRoute', () => {
    it('returns ordered sends', async () => {
      const builder = createBuilder({ data: [{ id: 's1' }], error: null });
      mockFrom.mockReturnValue(builder);

      const result = await sendsApi.listByRoute('r1');
      expect(result).toEqual([{ id: 's1' }]);
      expect(builder.eq).toHaveBeenCalledWith('route_id', 'r1');
      expect(builder.order).toHaveBeenCalledWith('sent_at', { ascending: false });
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(sendsApi.listByRoute('r1')).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('listByUser', () => {
    it('returns sends with route join', async () => {
      const builder = createBuilder({
        data: [{ id: 's1', route: { id: 'r1', title: 'T', grade: 'V3' } }],
        error: null,
      });
      mockFrom.mockReturnValue(builder);

      const result = await sendsApi.listByUser('u1');
      expect(result).toEqual([{ id: 's1', route: { id: 'r1', title: 'T', grade: 'V3' } }]);
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(sendsApi.listByUser('u1')).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('getByUserAndRoute', () => {
    it('returns send', async () => {
      const builder = createBuilder({ data: { id: 's1' }, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await sendsApi.getByUserAndRoute('u1', 'r1');
      expect(result).toEqual({ id: 's1' });
    });

    it('returns null when send not found', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await sendsApi.getByUserAndRoute('u1', 'r1');
      expect(result).toBeNull();
    });

    it('throws on other errors', async () => {
      const builder = createBuilder({ data: null, error: { code: 'OTHER', message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(sendsApi.getByUserAndRoute('u1', 'r1')).rejects.toEqual({ code: 'OTHER', message: 'fail' });
    });
  });

  describe('create', () => {
    it('inserts and invalidates sends', async () => {
      const builder = createBuilder({ data: { id: 's1' }, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('sends', listener));

      const send = { user_id: 'u1', route_id: 'r1' };
      const result = await sendsApi.create(send);

      expect(result).toEqual({ id: 's1' });
      expect(builder.insert).toHaveBeenCalledWith(send);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(sendsApi.create({ user_id: 'u1', route_id: 'r1' })).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('update', () => {
    it('updates and invalidates sends', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('sends', listener));

      await sendsApi.update('s1', { quality_rating: 5 });

      expect(builder.update).toHaveBeenCalledWith({ quality_rating: 5 });
      expect(builder.eq).toHaveBeenCalledWith('id', 's1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(sendsApi.update('s1', {})).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('delete', () => {
    it('deletes and invalidates sends', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('sends', listener));

      await sendsApi.delete('s1');

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 's1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(sendsApi.delete('s1')).rejects.toEqual({ message: 'fail' });
    });
  });
});

// ---------------------------------------------------------------------------
// commentsApi
// ---------------------------------------------------------------------------
describe('commentsApi', () => {
  describe('listByRoute', () => {
    it('returns comments ordered ascending', async () => {
      const builder = createBuilder({ data: [{ id: 'c1' }], error: null });
      mockFrom.mockReturnValue(builder);

      const result = await commentsApi.listByRoute('r1');
      expect(result).toEqual([{ id: 'c1' }]);
      expect(builder.eq).toHaveBeenCalledWith('route_id', 'r1');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(commentsApi.listByRoute('r1')).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('listByUser', () => {
    it('returns with route join', async () => {
      const builder = createBuilder({
        data: [{ id: 'c1', route: { id: 'r1', title: 'T', grade: 'V3' } }],
        error: null,
      });
      mockFrom.mockReturnValue(builder);

      const result = await commentsApi.listByUser('u1');
      expect(result).toEqual([{ id: 'c1', route: { id: 'r1', title: 'T', grade: 'V3' } }]);
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(commentsApi.listByUser('u1')).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('create', () => {
    it('inserts and invalidates comments', async () => {
      const builder = createBuilder({ data: { id: 'c1' }, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('comments', listener));

      const comment = { user_id: 'u1', route_id: 'r1', text: 'Nice!' };
      const result = await commentsApi.create(comment);

      expect(result).toEqual({ id: 'c1' });
      expect(builder.insert).toHaveBeenCalledWith(comment);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(commentsApi.create({
        user_id: 'u1', route_id: 'r1', text: 'X',
      })).rejects.toEqual({ message: 'fail' });
    });
  });

  describe('delete', () => {
    it('deletes and invalidates comments', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const listener = jest.fn();
      unsubs.push(cacheEvents.subscribe('comments', listener));

      await commentsApi.delete('c1');

      expect(builder.delete).toHaveBeenCalled();
      expect(builder.eq).toHaveBeenCalledWith('id', 'c1');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(commentsApi.delete('c1')).rejects.toEqual({ message: 'fail' });
    });
  });
});

// ---------------------------------------------------------------------------
// accountApi
// ---------------------------------------------------------------------------
describe('accountApi', () => {
  describe('deleteAllUserData', () => {
    it('deletes all user data in order and invalidates caches', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const sendsListener = jest.fn();
      const commentsListener = jest.fn();
      const routesListener = jest.fn();
      unsubs.push(cacheEvents.subscribe('sends', sendsListener));
      unsubs.push(cacheEvents.subscribe('comments', commentsListener));
      unsubs.push(cacheEvents.subscribe('routes', routesListener));

      await accountApi.deleteAllUserData('u1');

      expect(sendsListener).toHaveBeenCalledTimes(1);
      expect(commentsListener).toHaveBeenCalledTimes(1);
      expect(routesListener).toHaveBeenCalledTimes(1);
    });

    it('throws on sends deletion error and stops', async () => {
      const errorBuilder = createBuilder({ data: null, error: { message: 'sends fail', code: '42501' } });
      mockFrom.mockReturnValue(errorBuilder);

      await expect(accountApi.deleteAllUserData('u1')).rejects.toEqual({ message: 'sends fail', code: '42501' });
    });

    it('throws on comments deletion error after sends succeed', async () => {
      const okBuilder = createBuilder({ data: null, error: null });
      const errorBuilder = createBuilder({ data: null, error: { message: 'comments fail' } });
      // First call (sends) succeeds, second call (comments) fails
      mockFrom.mockReturnValueOnce(okBuilder).mockReturnValueOnce(errorBuilder);

      await expect(accountApi.deleteAllUserData('u1')).rejects.toEqual({ message: 'comments fail' });
    });
  });
});

// ---------------------------------------------------------------------------
// Error handling & cache invalidation during failures
// ---------------------------------------------------------------------------
describe('error handling - cache invalidation on failure', () => {
  it('routesApi.create does not invalidate cache when insert fails', async () => {
    const builder = createBuilder({ data: null, error: { message: 'constraint violation', code: '23505' } });
    mockFrom.mockReturnValue(builder);

    const listener = jest.fn();
    unsubs.push(cacheEvents.subscribe('routes', listener));

    await expect(routesApi.create({
      title: 'T', description: null, grade: 'V3',
      photo_id: 'p1', holds: { hand_holds: [], foot_holds: [] }, user_id: 'u1',
    })).rejects.toEqual({ message: 'constraint violation', code: '23505' });

    // Cache should NOT be invalidated because the error is thrown before invalidation
    expect(listener).not.toHaveBeenCalled();
  });

  it('routesApi.update does not invalidate cache when update fails', async () => {
    const builder = createBuilder({ data: null, error: { message: 'fail' } });
    mockFrom.mockReturnValue(builder);

    const routesListener = jest.fn();
    const routeListener = jest.fn();
    unsubs.push(cacheEvents.subscribe('routes', routesListener));
    unsubs.push(cacheEvents.subscribe('route', routeListener));

    await expect(routesApi.update('r1', { title: 'New' })).rejects.toEqual({ message: 'fail' });

    expect(routesListener).not.toHaveBeenCalled();
    expect(routeListener).not.toHaveBeenCalled();
  });

  it('routesApi.delete does not invalidate cache when delete fails', async () => {
    const builder = createBuilder({ data: null, error: { message: 'fail' } });
    mockFrom.mockReturnValue(builder);

    const listener = jest.fn();
    unsubs.push(cacheEvents.subscribe('routes', listener));

    await expect(routesApi.delete('r1')).rejects.toEqual({ message: 'fail' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('sendsApi.create does not invalidate cache when insert fails', async () => {
    const builder = createBuilder({ data: null, error: { message: 'duplicate send', code: '23505' } });
    mockFrom.mockReturnValue(builder);

    const listener = jest.fn();
    unsubs.push(cacheEvents.subscribe('sends', listener));

    await expect(sendsApi.create({ user_id: 'u1', route_id: 'r1' })).rejects.toEqual({
      message: 'duplicate send', code: '23505',
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('sendsApi.update does not invalidate cache when update fails', async () => {
    const builder = createBuilder({ data: null, error: { message: 'fail' } });
    mockFrom.mockReturnValue(builder);

    const listener = jest.fn();
    unsubs.push(cacheEvents.subscribe('sends', listener));

    await expect(sendsApi.update('s1', { quality_rating: 5 })).rejects.toEqual({ message: 'fail' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('commentsApi.create does not invalidate cache when insert fails', async () => {
    const builder = createBuilder({ data: null, error: { message: 'fail' } });
    mockFrom.mockReturnValue(builder);

    const listener = jest.fn();
    unsubs.push(cacheEvents.subscribe('comments', listener));

    await expect(commentsApi.create({
      user_id: 'u1', route_id: 'r1', text: 'X',
    })).rejects.toEqual({ message: 'fail' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('commentsApi.delete does not invalidate cache when delete fails', async () => {
    const builder = createBuilder({ data: null, error: { message: 'fail' } });
    mockFrom.mockReturnValue(builder);

    const listener = jest.fn();
    unsubs.push(cacheEvents.subscribe('comments', listener));

    await expect(commentsApi.delete('c1')).rejects.toEqual({ message: 'fail' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('photosApi.update does not invalidate cache when update fails', async () => {
    const builder = createBuilder({ data: null, error: { message: 'fail' } });
    mockFrom.mockReturnValue(builder);

    const listener = jest.fn();
    unsubs.push(cacheEvents.subscribe('photos', listener));

    await expect(photosApi.update('p1', { setup_date: '2025-01-01' })).rejects.toEqual({ message: 'fail' });

    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Pagination edge cases
// ---------------------------------------------------------------------------
describe('routesApi.list - pagination edge cases', () => {
  it('returns empty array and hasMore=false for last page (0 results)', async () => {
    const builder = createBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    const result = await routesApi.list(undefined, {
      cursor: { created_at: '2024-01-01T00:00:00Z', id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    });
    expect(result.data).toEqual([]);
    expect(result.hasMore).toBe(false);
  });

  it('returns hasMore=false when results exactly equal pageSize', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`, avg_rating: null, send_count: 0, photo: {},
    }));
    const builder = createBuilder({ data: items, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await routesApi.list(undefined, { pageSize: 5 });
    expect(result.data).toHaveLength(5);
    expect(result.hasMore).toBe(false);
  });

  it('returns hasMore=true with custom pageSize when results exceed it', async () => {
    const items = Array.from({ length: 4 }, (_, i) => ({
      id: `r${i}`, avg_rating: null, send_count: 0, photo: {},
    }));
    const builder = createBuilder({ data: items, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await routesApi.list(undefined, { pageSize: 3 });
    expect(result.data).toHaveLength(3);
    expect(result.hasMore).toBe(true);
  });

  it('requests pageSize + 1 from database to detect more results', async () => {
    const builder = createBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await routesApi.list(undefined, { pageSize: 10 });
    expect(builder.limit).toHaveBeenCalledWith(11);
  });
});
