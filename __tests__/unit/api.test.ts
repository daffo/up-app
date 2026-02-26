import { supabase } from '../../lib/supabase';
import {
  cacheEvents,
  routesApi,
  photosApi,
  detectedHoldsApi,
  userProfilesApi,
  sendsApi,
  commentsApi,
} from '../../lib/api';

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}));

const mockFrom = supabase.from as jest.Mock;

/**
 * Creates a chainable Supabase query builder mock.
 * Calling `await builder` resolves to `resolvedValue`.
 */
function createBuilder(resolvedValue: { data: any; error: any }) {
  const builder: any = {};
  const methods = [
    'select', 'eq', 'not', 'is', 'or', 'ilike', 'order',
    'insert', 'update', 'upsert', 'delete', 'single',
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
    it('computes avgRating and sendCount from sends array', async () => {
      const builder = createBuilder({
        data: [{
          id: 'r1', title: 'Route 1', sends: [
            { quality_rating: 4 },
            { quality_rating: 2 },
          ], photo: {},
        }],
        error: null,
      });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.list();
      expect(result).toHaveLength(1);
      expect(result[0].avgRating).toBe(3);
      expect(result[0].sendCount).toBe(2);
    });

    it('returns null avgRating when no ratings', async () => {
      const builder = createBuilder({
        data: [{
          id: 'r1', sends: [{ quality_rating: null }], photo: {},
        }],
        error: null,
      });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.list();
      expect(result[0].avgRating).toBeNull();
      expect(result[0].sendCount).toBe(1);
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

    it('returns [] when data is null', async () => {
      const builder = createBuilder({ data: null, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await routesApi.list();
      expect(result).toEqual([]);
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
      expect(builder.single).toHaveBeenCalled();
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
        photo_id: 'p1', holds: [], user_id: 'u1',
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
        photo_id: 'p1', holds: [], user_id: 'u1',
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
    it('returns holds', async () => {
      const builder = createBuilder({ data: [{ id: 'h1' }], error: null });
      mockFrom.mockReturnValue(builder);

      const result = await detectedHoldsApi.listByPhoto('p1');
      expect(result).toEqual([{ id: 'h1' }]);
      expect(builder.eq).toHaveBeenCalledWith('photo_id', 'p1');
    });

    it('throws on error', async () => {
      const builder = createBuilder({ data: null, error: { message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(detectedHoldsApi.listByPhoto('p1')).rejects.toEqual({ message: 'fail' });
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
});

// ---------------------------------------------------------------------------
// userProfilesApi
// ---------------------------------------------------------------------------
describe('userProfilesApi', () => {
  describe('get', () => {
    it('returns profile', async () => {
      const builder = createBuilder({ data: { user_id: 'u1', display_name: 'Alice' }, error: null });
      mockFrom.mockReturnValue(builder);

      const result = await userProfilesApi.get('u1');
      expect(result).toEqual({ user_id: 'u1', display_name: 'Alice' });
    });

    it('returns null on PGRST116 (not found)', async () => {
      const builder = createBuilder({ data: null, error: { code: 'PGRST116' } });
      mockFrom.mockReturnValue(builder);

      const result = await userProfilesApi.get('u1');
      expect(result).toBeNull();
    });

    it('throws on other errors', async () => {
      const builder = createBuilder({ data: null, error: { code: 'OTHER', message: 'fail' } });
      mockFrom.mockReturnValue(builder);

      await expect(userProfilesApi.get('u1')).rejects.toEqual({ code: 'OTHER', message: 'fail' });
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

    it('returns null on PGRST116', async () => {
      const builder = createBuilder({ data: null, error: { code: 'PGRST116' } });
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
