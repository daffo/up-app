// Polygon utility functions for hold detection

export interface Point {
  x: number;
  y: number;
}

// Point-in-polygon test using ray casting algorithm
export const isPointInPolygon = (x: number, y: number, polygon: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Calculate polygon area using shoelace formula
export const calculatePolygonArea = (polygon: Point[]): number => {
  if (polygon.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return Math.abs(area / 2);
};

// Find all polygons containing a point, sorted by area (smallest first)
export const findPolygonsAtPoint = <T extends { polygon: Point[] }>(
  x: number,
  y: number,
  items: T[]
): T[] => {
  const matching = items.filter(item => isPointInPolygon(x, y, item.polygon));
  return matching.sort((a, b) => calculatePolygonArea(a.polygon) - calculatePolygonArea(b.polygon));
};

// Find the smallest polygon containing a point
export const findSmallestPolygonAtPoint = <T extends { polygon: Point[] }>(
  x: number,
  y: number,
  items: T[]
): T | null => {
  const sorted = findPolygonsAtPoint(x, y, items);
  return sorted.length > 0 ? sorted[0] : null;
};
