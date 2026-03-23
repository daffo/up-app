import {
  getLocalImageUri,
  invalidateImage,
  _clearMemoryCache,
} from '../../lib/cache/image-file-cache';

const mockDownloadFileAsync = jest.fn();
const mockFileStore = new Map<string, { exists: boolean; size: number }>();

jest.mock('expo-file-system', () => {
  return {
    Paths: { document: 'file:///data/app' },
    File: Object.assign(
      function MockFile(...segments: string[]) {
        const uri = segments.join('/');
        const stored = mockFileStore.get(uri) || { exists: false, size: 0 };
        return {
          get exists() { return stored.exists; },
          get size() { return stored.size; },
          uri,
          delete: jest.fn(() => { stored.exists = false; stored.size = 0; }),
          move: jest.fn(),
        };
      },
      {
        downloadFileAsync: (...args: unknown[]) => mockDownloadFileAsync(...args),
      },
    ),
    Directory: function MockDirectory(...segments: string[]) {
      const uri = segments.join('/');
      return { uri, exists: true, create: jest.fn() };
    },
  };
});

const CACHE_DIR = 'file:///data/app/image-cache';

function setFileState(filename: string, exists: boolean, size = 0) {
  mockFileStore.set(`${CACHE_DIR}/${filename}`, { exists, size });
}

beforeEach(() => {
  _clearMemoryCache();
  mockFileStore.clear();
  jest.clearAllMocks();
});

describe('getLocalImageUri', () => {
  it('downloads and returns local URI on first access', async () => {
    setFileState('2025-fall.jpg', false);

    mockDownloadFileAsync.mockImplementation(() => {
      setFileState('2025-fall.jpg', true, 50000);
      return { exists: true, size: 50000, uri: `${CACHE_DIR}/2025-fall.jpg`, move: jest.fn() };
    });

    const uri = await getLocalImageUri('https://example.com/storage/2025-fall.jpg');

    expect(uri).toBe(`${CACHE_DIR}/2025-fall.jpg`);
    expect(mockDownloadFileAsync).toHaveBeenCalled();
  });

  it('serves from disk without downloading', async () => {
    setFileState('2025-fall.jpg', true, 50000);

    const uri = await getLocalImageUri('https://example.com/storage/2025-fall.jpg');

    expect(uri).toBe(`${CACHE_DIR}/2025-fall.jpg`);
    expect(mockDownloadFileAsync).not.toHaveBeenCalled();
  });

  it('serves from memory cache on repeated calls', async () => {
    setFileState('photo.jpg', true, 100);

    await getLocalImageUri('https://example.com/photo.jpg');

    // Clear file state — would fail if disk is checked again
    mockFileStore.clear();
    const uri = await getLocalImageUri('https://example.com/photo.jpg');
    expect(uri).toBe(`${CACHE_DIR}/photo.jpg`);
  });

  it('deduplicates concurrent requests for the same URL', async () => {
    setFileState('wall.jpg', false);

    mockDownloadFileAsync.mockImplementation(() => {
      setFileState('wall.jpg', true, 50000);
      return { exists: true, size: 50000, uri: `${CACHE_DIR}/wall.jpg`, move: jest.fn() };
    });

    const [uri1, uri2] = await Promise.all([
      getLocalImageUri('https://example.com/wall.jpg'),
      getLocalImageUri('https://example.com/wall.jpg'),
    ]);

    expect(uri1).toBe(uri2);
    expect(mockDownloadFileAsync).toHaveBeenCalledTimes(1);
  });

  it('throws on download failure', async () => {
    setFileState('bad.jpg', false);

    mockDownloadFileAsync.mockImplementation(() => {
      return { exists: false, size: 0, uri: '', delete: jest.fn(), move: jest.fn() };
    });

    await expect(getLocalImageUri('https://example.com/bad.jpg')).rejects.toThrow('Download failed');
  });

  it('strips query params from filename', async () => {
    setFileState('photo.jpg', true, 100);

    const uri = await getLocalImageUri('https://example.com/photo.jpg?token=abc');
    expect(uri).toBe(`${CACHE_DIR}/photo.jpg`);
  });
});

describe('invalidateImage', () => {
  it('removes from memory so next call re-checks disk', async () => {
    setFileState('old.jpg', true, 100);
    await getLocalImageUri('https://example.com/old.jpg');

    invalidateImage('https://example.com/old.jpg');

    // File state is now false (delete was called)
    // Next call should need to download
    mockDownloadFileAsync.mockImplementation(() => {
      setFileState('old.jpg', true, 100);
      return { exists: true, size: 100, uri: `${CACHE_DIR}/old.jpg`, move: jest.fn() };
    });

    await getLocalImageUri('https://example.com/old.jpg');
    expect(mockDownloadFileAsync).toHaveBeenCalled();
  });
});
