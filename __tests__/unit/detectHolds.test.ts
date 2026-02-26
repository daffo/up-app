import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { detectHolds } from '../../lib/holdDetection';

jest.mock('react-native', () => ({
  Image: { getSize: jest.fn() },
}));

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

const mockGetSize = Image.getSize as jest.Mock;
const mockManipulate = manipulateAsync as jest.Mock;
const mockFetch = jest.fn();

beforeEach(() => {
  global.fetch = mockFetch as any;
  mockFetch.mockReset();
  mockGetSize.mockReset();
  mockManipulate.mockReset();
});

/** Set up Image.getSize to resolve with given dimensions */
function mockImageSize(width: number, height: number) {
  mockGetSize.mockImplementation(
    (_uri: string, onSuccess: (w: number, h: number) => void) => {
      onSuccess(width, height);
    },
  );
}

/** Set up manipulateAsync to return base64 for every tile */
function mockAllTiles(base64 = 'AAAA') {
  mockManipulate.mockResolvedValue({ base64 });
}

/** Create a mock fetch Response */
function mockFetchOk(predictions: any[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ predictions }),
    text: async () => '',
  };
}

function mockFetchError(status: number, body = 'error') {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  };
}

describe('detectHolds', () => {
  // Use 900x900 for clean tile math: tileWidth=300, overlapX=90
  const IMG_W = 900;
  const IMG_H = 900;

  describe('happy path', () => {
    it('converts polygon prediction to percentage coords', async () => {
      mockImageSize(IMG_W, IMG_H);
      mockAllTiles();

      // Only the first tile returns a prediction; rest return empty
      const pred = {
        points: [
          { x: 90, y: 90 },
          { x: 180, y: 90 },
          { x: 180, y: 180 },
          { x: 90, y: 180 },
        ],
        confidence: 0.9,
      };
      mockFetch
        .mockResolvedValueOnce(mockFetchOk([pred]))
        .mockResolvedValue(mockFetchOk([]));

      const results = await detectHolds('file://img.jpg', 'key', 0.5);

      expect(results).toHaveLength(1);
      // Points at (90,90) in 900px image = 10%
      // First tile: x1=0, y1=0, so tile-local coords get +0 adjustment
      expect(results[0].polygon[0]).toEqual({ x: 10, y: 10 });
      expect(results[0].polygon[2]).toEqual({ x: 20, y: 20 });
      expect(results[0].center.x).toBe(15);
      expect(results[0].center.y).toBe(15);
      expect(results[0].confidence).toBe(0.9);
    });

    it('uses bounding box fallback when no points', async () => {
      mockImageSize(IMG_W, IMG_H);
      mockAllTiles();

      const pred = { x: 450, y: 450, width: 90, height: 90, confidence: 0.8 };
      mockFetch
        .mockResolvedValueOnce(mockFetchOk([pred]))
        .mockResolvedValue(mockFetchOk([]));

      const results = await detectHolds('file://img.jpg', 'key', 0.5);

      expect(results).toHaveLength(1);
      // bbox center at (450,450) = 50%
      expect(results[0].center).toEqual({ x: 50, y: 50 });
      // 4-point rectangle
      expect(results[0].polygon).toHaveLength(4);
      // Top-left: (450-45)/900*100 = 45%, bottom-right: (450+45)/900*100 = 55%
      expect(results[0].polygon[0]).toEqual({ x: 45, y: 45 });
      expect(results[0].polygon[2]).toEqual({ x: 55, y: 55 });
    });

    it('calls progress callback 9 times for 3x3 tiles', async () => {
      mockImageSize(IMG_W, IMG_H);
      mockAllTiles();
      mockFetch.mockResolvedValue(mockFetchOk([]));

      const onProgress = jest.fn();
      await detectHolds('file://img.jpg', 'key', 0.5, onProgress);

      expect(onProgress).toHaveBeenCalledTimes(9);
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 9);
      expect(onProgress).toHaveBeenNthCalledWith(9, 9, 9);
    });

    it('adjusts tile coordinates to full-image space', async () => {
      mockImageSize(IMG_W, IMG_H);
      mockAllTiles();

      // Place a prediction in the last tile (col=2, row=2)
      // For 900px with tileWidth=300, overlap=90:
      // x1 = max(0, 2*300 - 90) = 510
      // y1 = max(0, 2*300 - 90) = 510
      const pred = {
        points: [
          { x: 10, y: 10 },  // tile-local; becomes 520, 520 full-image
          { x: 100, y: 10 },
          { x: 100, y: 100 },
          { x: 10, y: 100 },
        ],
        confidence: 0.9,
      };

      // Tiles 1-8 return empty, tile 9 returns the prediction
      for (let i = 0; i < 8; i++) {
        mockFetch.mockResolvedValueOnce(mockFetchOk([]));
      }
      mockFetch.mockResolvedValueOnce(mockFetchOk([pred]));

      const results = await detectHolds('file://img.jpg', 'key', 0.5);

      expect(results).toHaveLength(1);
      // (10+510)/900*100 ≈ 57.78, (100+510)/900*100 ≈ 67.78
      expect(results[0].polygon[0].x).toBeCloseTo(57.78, 1);
      expect(results[0].polygon[0].y).toBeCloseTo(57.78, 1);
    });

    it('filters out low-confidence predictions', async () => {
      mockImageSize(IMG_W, IMG_H);
      mockAllTiles();

      const lowConf = { x: 100, y: 100, width: 50, height: 50, confidence: 0.2 };
      const highConf = { x: 500, y: 500, width: 50, height: 50, confidence: 0.8 };
      mockFetch
        .mockResolvedValueOnce(mockFetchOk([lowConf, highConf]))
        .mockResolvedValue(mockFetchOk([]));

      const results = await detectHolds('file://img.jpg', 'key', 0.5);

      expect(results).toHaveLength(1);
      expect(results[0].confidence).toBe(0.8);
    });

    it('returns empty array when all tiles have no predictions', async () => {
      mockImageSize(IMG_W, IMG_H);
      mockAllTiles();
      mockFetch.mockResolvedValue(mockFetchOk([]));

      const results = await detectHolds('file://img.jpg', 'key', 0.5);
      expect(results).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('rejects when Image.getSize fails', async () => {
      mockGetSize.mockImplementation(
        (_uri: string, _onSuccess: any, onError: (e: Error) => void) => {
          onError(new Error('cannot load'));
        },
      );

      await expect(
        detectHolds('file://bad.jpg', 'key'),
      ).rejects.toThrow('cannot load');
    });

    it('throws immediately on 4xx without retrying', async () => {
      mockImageSize(IMG_W, IMG_H);
      mockAllTiles();
      mockFetch.mockResolvedValue(mockFetchError(400, 'bad request'));

      await expect(
        detectHolds('file://img.jpg', 'key', 0.5),
      ).rejects.toThrow('Roboflow API error 400: bad request');
      // Only 1 fetch call (no retries)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 5xx then succeeds', async () => {
      mockImageSize(IMG_W, IMG_H);
      mockAllTiles();

      // First tile: 500, then 200
      mockFetch
        .mockResolvedValueOnce(mockFetchError(500))
        .mockResolvedValueOnce(mockFetchOk([]))
        // Remaining 8 tiles succeed
        .mockResolvedValue(mockFetchOk([]));

      // Should not throw
      const results = await detectHolds('file://img.jpg', 'key', 0.5);
      expect(results).toEqual([]);
      // 1 failed + 1 retry + 8 remaining = 10
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });

    it('throws after exhausting retries on 5xx', async () => {
      mockImageSize(IMG_W, IMG_H);
      mockAllTiles();

      mockFetch.mockResolvedValue(mockFetchError(500, 'server down'));

      await expect(
        detectHolds('file://img.jpg', 'key', 0.5),
      ).rejects.toThrow('Roboflow API error 500: server down');
      // 3 attempts (default maxRetries)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('edge cases', () => {
    it('skips tile when manipulateAsync returns null base64', async () => {
      mockImageSize(IMG_W, IMG_H);

      // First tile: null base64 (skipped), rest: normal
      mockManipulate
        .mockResolvedValueOnce({ base64: null })
        .mockResolvedValue({ base64: 'AAAA' });

      mockFetch.mockResolvedValue(mockFetchOk([]));

      const results = await detectHolds('file://img.jpg', 'key', 0.5);
      expect(results).toEqual([]);
      // Only 8 fetch calls (first tile was skipped)
      expect(mockFetch).toHaveBeenCalledTimes(8);
    });

    it('deduplicates overlapping tile predictions', async () => {
      mockImageSize(IMG_W, IMG_H);
      mockAllTiles();

      // Two adjacent tiles return the same hold (in overlap region)
      // Tile 1 (col=0,row=0): x1=0, y1=0 -> point at (280,150) -> full-image (280,150)
      // Tile 2 (col=1,row=0): x1=210, y1=0 -> point at (70,150) -> full-image (280,150)
      const pred1 = {
        points: [
          { x: 270, y: 140 }, { x: 290, y: 140 },
          { x: 290, y: 160 }, { x: 270, y: 160 },
        ],
        confidence: 0.9,
      };
      const pred2 = {
        points: [
          { x: 60, y: 140 }, { x: 80, y: 140 },
          { x: 80, y: 160 }, { x: 60, y: 160 },
        ],
        confidence: 0.85,
      };

      mockFetch
        .mockResolvedValueOnce(mockFetchOk([pred1]))  // tile 1
        .mockResolvedValueOnce(mockFetchOk([pred2]))  // tile 2
        .mockResolvedValue(mockFetchOk([]));           // rest

      const results = await detectHolds('file://img.jpg', 'key', 0.5);

      // Should deduplicate since the centers are essentially the same
      expect(results).toHaveLength(1);
      expect(results[0].confidence).toBe(0.9); // higher confidence kept
    });

    it('computes center from polygon points correctly', async () => {
      mockImageSize(1000, 1000);
      mockAllTiles();

      const pred = {
        points: [
          { x: 100, y: 200 },
          { x: 300, y: 200 },
          { x: 300, y: 400 },
          { x: 100, y: 400 },
        ],
        confidence: 0.95,
      };
      mockFetch
        .mockResolvedValueOnce(mockFetchOk([pred]))
        .mockResolvedValue(mockFetchOk([]));

      const results = await detectHolds('file://img.jpg', 'key', 0.5);

      expect(results).toHaveLength(1);
      // Center of polygon: (200, 300) -> 20%, 30%
      expect(results[0].center).toEqual({ x: 20, y: 30 });
    });
  });
});
