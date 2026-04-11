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

// Mock image-file-cache — returns a local file:// path
jest.mock('../../lib/cache/image-file-cache', () => ({
  getLocalImageUri: jest.fn((url: string) => {
    const filename = url.split('/').pop();
    return Promise.resolve(`file:///data/app/image-cache/${filename}`);
  }),
}));

// Mock react-native Image.getSize and Platform
jest.mock('react-native', () => ({
  Image: {
    getSize: jest.fn(),
  },
  Platform: {
    OS: 'android',
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

  it('resolves local URI and measures with RNImage.getSize', async () => {
    const { Image: RNImage } = require('react-native');
    RNImage.getSize.mockImplementation(
      (url: string, success: (w: number, h: number) => void) => {
        // Verify it receives the local file URI, not the remote URL
        expect(url).toBe('file:///data/app/image-cache/new.jpg');
        success(1200, 800);
      },
    );

    const dims = await getImageDimensions('https://example.com/new.jpg');
    expect(dims).toEqual({ width: 1200, height: 800 });
  });
});
