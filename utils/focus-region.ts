// Focus region coordinate helpers for hold editor
// Extracted from FullScreenHoldEditor for testability

import { Point } from './polygon';

export interface FocusRegion {
  x: number; // percentage
  y: number;
  width: number;
  height: number;
}

/** Clamp a focus region centered on (centerX, centerY) with given size to stay within 0-100% bounds */
export function clampFocusRegion(centerX: number, centerY: number, size: number): FocusRegion {
  const halfSize = size / 2;

  let minX = centerX - halfSize;
  let maxX = centerX + halfSize;
  let minY = centerY - halfSize;
  let maxY = centerY + halfSize;

  // Shift region to stay within bounds
  if (minX < 0) { maxX -= minX; minX = 0; }
  if (maxX > 100) { minX -= (maxX - 100); maxX = 100; }
  if (minY < 0) { maxY -= minY; minY = 0; }
  if (maxY > 100) { minY -= (maxY - 100); maxY = 100; }

  // Final clamp
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(100, maxX);
  maxY = Math.min(100, maxY);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Filter detected holds whose center falls within the focus region */
export function filterHoldsInRegion<T extends { polygon: Point[] }>(holds: T[], region: FocusRegion): T[] {
  return holds.filter(hold => {
    const center = calculateCentroid(hold.polygon);
    return (
      center.x >= region.x &&
      center.x <= region.x + region.width &&
      center.y >= region.y &&
      center.y <= region.y + region.height
    );
  });
}

/** Map hold coordinates from image-space (0-100%) to focus-region-space (0-100%) */
export function mapHoldsToFocusRegion<T extends { polygon: Point[]; center: Point }>(
  holds: T[], region: FocusRegion
): T[] {
  return holds.map(hold => ({
    ...hold,
    polygon: hold.polygon.map(p => ({
      x: ((p.x - region.x) / region.width) * 100,
      y: ((p.y - region.y) / region.height) * 100,
    })),
    center: {
      x: ((hold.center.x - region.x) / region.width) * 100,
      y: ((hold.center.y - region.y) / region.height) * 100,
    },
  }));
}

/** Apply a delta offset to a detected hold's polygon and center */
export function applyMoveDelta<T extends { polygon: Point[]; center: Point }>(
  hold: T, delta: Point
): T {
  return {
    ...hold,
    polygon: hold.polygon.map(p => ({
      x: p.x + delta.x,
      y: p.y + delta.y,
    })),
    center: {
      x: hold.center.x + delta.x,
      y: hold.center.y + delta.y,
    },
  };
}

/** Convert brush strokes in focus-region coordinates back to image coordinates */
export function focusCoordsToImageCoords(
  polygon: Point[], region: FocusRegion
): Point[] {
  return polygon.map(p => ({
    x: region.x + (p.x / 100) * region.width,
    y: region.y + (p.y / 100) * region.height,
  }));
}

/** Calculate the centroid of a polygon */
export function calculateCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 };
  return {
    x: polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length,
    y: polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length,
  };
}
