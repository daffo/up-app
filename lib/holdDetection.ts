import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MODEL_ENDPOINT = 'hold-detector-rnvkl/2';
const API_URL = `https://serverless.roboflow.com/${MODEL_ENDPOINT}`;

interface RoboflowPoint {
  x: number;
  y: number;
}

export interface RoboflowPrediction {
  points?: RoboflowPoint[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  confidence?: number;
  class?: string;
}

export interface DetectedHoldResult {
  polygon: Array<{ x: number; y: number }>;
  center: { x: number; y: number };
  confidence: number;
}

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (error) => reject(error),
    );
  });
}

async function callApi(
  base64Data: string,
  apiKey: string,
  confidence: number,
  maxRetries = 3,
): Promise<RoboflowPrediction[]> {
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    lastResponse = await fetch(
      `${API_URL}?api_key=${encodeURIComponent(apiKey)}&confidence=${Math.round(confidence * 100)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: base64Data,
      },
    );

    if (lastResponse.ok) {
      const json = await lastResponse.json();
      return json.predictions ?? [];
    }

    if (lastResponse.status < 500) break;

    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
  }

  const text = await lastResponse!.text();
  throw new Error(`Roboflow API error ${lastResponse!.status}: ${text}`);
}

export function deduplicatePredictions(
  predictions: RoboflowPrediction[],
  thresholdPercent: number,
  imageWidth: number,
  imageHeight: number,
): RoboflowPrediction[] {
  if (!predictions.length) return [];

  // Filter out predictions with empty points
  const filtered = predictions.filter(
    (p) => !p.points || p.points.length > 0,
  );

  // Calculate centers in percentage space
  const centers = filtered.map((pred) => {
    if (pred.points && pred.points.length > 0) {
      const cx = pred.points.reduce((s, p) => s + p.x, 0) / pred.points.length;
      const cy = pred.points.reduce((s, p) => s + p.y, 0) / pred.points.length;
      return { x: (cx / imageWidth) * 100, y: (cy / imageHeight) * 100 };
    }
    return {
      x: ((pred.x ?? 0) / imageWidth) * 100,
      y: ((pred.y ?? 0) / imageHeight) * 100,
    };
  });

  const keep = new Array(filtered.length).fill(true);

  for (let i = 0; i < filtered.length; i++) {
    if (!keep[i]) continue;
    for (let j = i + 1; j < filtered.length; j++) {
      if (!keep[j]) continue;
      const dist = Math.sqrt(
        (centers[i].x - centers[j].x) ** 2 + (centers[i].y - centers[j].y) ** 2,
      );
      if (dist < thresholdPercent) {
        if ((filtered[i].confidence ?? 0) >= (filtered[j].confidence ?? 0)) {
          keep[j] = false;
        } else {
          keep[i] = false;
          break;
        }
      }
    }
  }

  return filtered.filter((_, i) => keep[i]);
}

export async function detectHolds(
  imageUrl: string,
  apiKey: string,
  confidence = 0.5,
  onProgress?: (tile: number, total: number) => void,
): Promise<DetectedHoldResult[]> {
  // Get image dimensions
  const { width, height } = await getImageSize(imageUrl);

  // 3x3 tile grid with 30% overlap
  const tileCols = 3;
  const tileRows = 3;
  const totalTiles = tileCols * tileRows;
  const overlap = 0.3;

  const tileWidth = Math.floor(width / tileCols);
  const tileHeight = Math.floor(height / tileRows);
  const overlapX = Math.floor(tileWidth * overlap);
  const overlapY = Math.floor(tileHeight * overlap);

  const allPredictions: RoboflowPrediction[] = [];
  let tileIndex = 0;

  for (let row = 0; row < tileRows; row++) {
    for (let col = 0; col < tileCols; col++) {
      tileIndex++;
      onProgress?.(tileIndex, totalTiles);

      // Calculate tile boundaries with overlap
      const x1 = Math.max(0, col * tileWidth - overlapX);
      const y1 = Math.max(0, row * tileHeight - overlapY);
      const x2 = Math.min(width, (col + 1) * tileWidth + overlapX);
      const y2 = Math.min(height, (row + 1) * tileHeight + overlapY);
      const cropWidth = x2 - x1;
      const cropHeight = y2 - y1;

      // Crop tile and get base64
      const result = await manipulateAsync(
        imageUrl,
        [{ crop: { originX: x1, originY: y1, width: cropWidth, height: cropHeight } }],
        { base64: true, format: SaveFormat.JPEG },
      );

      if (!result.base64) continue;

      // Call Roboflow API
      const predictions = await callApi(result.base64, apiKey, confidence);

      // Adjust tile-local coordinates to full-image space
      for (const pred of predictions) {
        if (pred.points) {
          for (const point of pred.points) {
            point.x += x1;
            point.y += y1;
          }
        } else {
          pred.x = (pred.x ?? 0) + x1;
          pred.y = (pred.y ?? 0) + y1;
        }
      }

      allPredictions.push(...predictions);
    }
  }

  // Deduplicate by center proximity (~0.5% of image in percentage space)
  const deduped = deduplicatePredictions(allPredictions, 0.5, width, height);

  // Convert to percentage-based coordinates
  const results: DetectedHoldResult[] = [];

  for (const pred of deduped) {
    if ((pred.confidence ?? 0) < confidence) continue;

    let polygon: Array<{ x: number; y: number }>;
    let centerX: number;
    let centerY: number;

    if (pred.points && pred.points.length > 0) {
      polygon = pred.points.map((p) => ({
        x: Math.round(((p.x / width) * 100) * 100) / 100,
        y: Math.round(((p.y / height) * 100) * 100) / 100,
      }));
      centerX = polygon.reduce((s, p) => s + p.x, 0) / polygon.length;
      centerY = polygon.reduce((s, p) => s + p.y, 0) / polygon.length;
    } else {
      // Fallback to bounding box
      const x = pred.x ?? 0;
      const y = pred.y ?? 0;
      const w = pred.width ?? 0;
      const h = pred.height ?? 0;
      polygon = [
        { x: Math.round((((x - w / 2) / width) * 100) * 100) / 100, y: Math.round((((y - h / 2) / height) * 100) * 100) / 100 },
        { x: Math.round((((x + w / 2) / width) * 100) * 100) / 100, y: Math.round((((y - h / 2) / height) * 100) * 100) / 100 },
        { x: Math.round((((x + w / 2) / width) * 100) * 100) / 100, y: Math.round((((y + h / 2) / height) * 100) * 100) / 100 },
        { x: Math.round((((x - w / 2) / width) * 100) * 100) / 100, y: Math.round((((y + h / 2) / height) * 100) * 100) / 100 },
      ];
      centerX = Math.round(((x / width) * 100) * 100) / 100;
      centerY = Math.round(((y / height) * 100) * 100) / 100;
    }

    results.push({
      polygon,
      center: {
        x: Math.round(centerX * 100) / 100,
        y: Math.round(centerY * 100) / 100,
      },
      confidence: Math.round((pred.confidence ?? 0) * 1000) / 1000,
    });
  }

  return results;
}
