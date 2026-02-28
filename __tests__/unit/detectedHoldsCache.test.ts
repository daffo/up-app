import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCachedHolds,
  setCachedHolds,
  invalidateHoldsCache,
  _clearCache,
} from '../../lib/cache/detected-holds-cache';
import { DetectedHold } from '../../types/database.types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

const sampleHolds: DetectedHold[] = [
  {
    id: 'h1',
    photo_id: 'p1',
    polygon: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 15, y: 20 }],
    center: { x: 15, y: 13 },
    created_at: '2025-01-01T00:00:00Z',
  },
];

beforeEach(() => {
  _clearCache();
  jest.clearAllMocks();
});

describe('getCachedHolds', () => {
  it('returns null when no cache exists', async () => {
    mockGetItem.mockResolvedValue(null);
    const result = await getCachedHolds('p1', 1);
    expect(result).toBeNull();
  });

  it('returns null when version does not match', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ version: 1, holds: sampleHolds }));
    const result = await getCachedHolds('p1', 2);
    expect(result).toBeNull();
  });

  it('returns cached holds when version matches (from AsyncStorage)', async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ version: 3, holds: sampleHolds }));
    const result = await getCachedHolds('p1', 3);
    expect(result).toEqual(sampleHolds);
  });

  it('returns from memory cache on second call (no AsyncStorage hit)', async () => {
    // First: populate memory via setCachedHolds
    await setCachedHolds('p1', 5, sampleHolds);
    mockGetItem.mockClear();

    const result = await getCachedHolds('p1', 5);
    expect(result).toEqual(sampleHolds);
    // Should NOT have called AsyncStorage since memory cache had it
    expect(mockGetItem).not.toHaveBeenCalled();
  });
});

describe('setCachedHolds', () => {
  it('stores in memory and AsyncStorage', async () => {
    await setCachedHolds('p1', 2, sampleHolds);

    expect(mockSetItem).toHaveBeenCalledWith(
      '@detected_holds:p1',
      JSON.stringify({ version: 2, holds: sampleHolds }),
    );

    // Verify memory cache
    const result = await getCachedHolds('p1', 2);
    expect(result).toEqual(sampleHolds);
  });
});

describe('invalidateHoldsCache', () => {
  it('removes from memory and AsyncStorage', async () => {
    await setCachedHolds('p1', 1, sampleHolds);
    await invalidateHoldsCache('p1');

    expect(mockRemoveItem).toHaveBeenCalledWith('@detected_holds:p1');

    // Memory cache should be cleared
    mockGetItem.mockResolvedValue(null);
    const result = await getCachedHolds('p1', 1);
    expect(result).toBeNull();
  });
});
