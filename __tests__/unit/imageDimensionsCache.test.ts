import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initImageDimensionsCache,
  getImageDimensions,
  setImageDimensions,
  _clearCache,
} from '../../lib/cache/image-cache';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-image
jest.mock('expo-image', () => ({
  Image: {
    prefetch: jest.fn(),
  },
}));

// Mock react-native Image.getSize
jest.mock('react-native', () => ({
  Image: {
    getSize: jest.fn(),
  },
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  _clearCache();
  jest.clearAllMocks();
});

describe('initImageDimensionsCache', () => {
  it('hydrates memory cache from AsyncStorage', async () => {
    const stored = { 'https://example.com/photo.jpg': { width: 1000, height: 2000 } };
    mockGetItem.mockResolvedValue(JSON.stringify(stored));

    await initImageDimensionsCache();

    // Now getImageDimensions should return from memory
    const dims = await getImageDimensions('https://example.com/photo.jpg');
    expect(dims).toEqual({ width: 1000, height: 2000 });
  });

  it('handles missing AsyncStorage data gracefully', async () => {
    mockGetItem.mockResolvedValue(null);
    await expect(initImageDimensionsCache()).resolves.not.toThrow();
  });

  it('handles corrupt AsyncStorage data gracefully', async () => {
    mockGetItem.mockResolvedValue('not-json');
    await expect(initImageDimensionsCache()).resolves.not.toThrow();
  });
});

describe('setImageDimensions', () => {
  it('stores dimensions in memory cache', async () => {
    setImageDimensions('https://example.com/a.jpg', 800, 600);
    const dims = await getImageDimensions('https://example.com/a.jpg');
    expect(dims).toEqual({ width: 800, height: 600 });
  });
});

describe('getImageDimensions', () => {
  it('returns from memory cache if available', async () => {
    setImageDimensions('https://example.com/b.jpg', 500, 400);
    const dims = await getImageDimensions('https://example.com/b.jpg');
    expect(dims).toEqual({ width: 500, height: 400 });
  });

  it('falls back to RNImage.getSize when not in cache', async () => {
    const { Image: RNImage } = require('react-native');
    RNImage.getSize.mockImplementation(
      (_url: string, success: (w: number, h: number) => void) => {
        success(1200, 800);
      },
    );

    const dims = await getImageDimensions('https://example.com/new.jpg');
    expect(dims).toEqual({ width: 1200, height: 800 });
  });
});
