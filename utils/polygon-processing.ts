// Polygon processing functions for hold shape extraction
// Extracted from FullScreenHoldEditor for testability

type Point = { x: number; y: number };

/** Calculate perpendicular distance from point to line */
export function perpendicularDistance(
  point: Point,
  lineStart: Point,
  lineEnd: Point
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);

  const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
  const closestX = lineStart.x + u * dx;
  const closestY = lineStart.y + u * dy;
  return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
}

/** Douglas-Peucker polygon simplification */
export function simplifyPolygon(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from line between first and last
  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = simplifyPolygon(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPolygon(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  } else {
    return [first, last];
  }
}

/** Compute convex hull using Graham scan */
export function computeConvexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;

  // Find bottom-most point (or left-most in case of tie)
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < points[start].y ||
        (points[i].y === points[start].y && points[i].x < points[start].x)) {
      start = i;
    }
  }

  const pivot = points[start];

  // Sort by polar angle with pivot
  const sorted = points
    .filter((_, i) => i !== start)
    .sort((a, b) => {
      const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
      const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
      return angleA - angleB;
    });

  const hull: Point[] = [pivot];

  for (const point of sorted) {
    while (hull.length > 1) {
      const top = hull[hull.length - 1];
      const second = hull[hull.length - 2];
      const cross = (top.x - second.x) * (point.y - second.y) - (top.y - second.y) * (point.x - second.x);
      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(point);
  }

  return hull;
}

/** Extract outline from brush strokes using a grid-based approach */
export function extractOutlineFromBrushStrokes(
  strokes: Point[],
  radius: number
): Point[] {
  // Create a grid to represent the painted area
  const gridSize = 100; // 100x100 grid for 0-100% coordinate space
  const grid: boolean[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));

  // Mark cells that are within brush radius of any stroke point
  const radiusCells = Math.ceil(radius);
  for (const point of strokes) {
    const centerX = Math.floor(point.x);
    const centerY = Math.floor(point.y);

    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        const gx = centerX + dx;
        const gy = centerY + dy;
        if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            grid[gy][gx] = true;
          }
        }
      }
    }
  }

  // Extract contour using marching squares (simplified)
  const contourPoints: Point[] = [];

  // Find edge cells (filled cells adjacent to empty cells or boundary)
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (grid[y][x]) {
        // Check if this is an edge cell
        const isEdge =
          x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1 ||
          !grid[y - 1]?.[x] || !grid[y + 1]?.[x] ||
          !grid[y]?.[x - 1] || !grid[y]?.[x + 1];

        if (isEdge) {
          contourPoints.push({ x, y });
        }
      }
    }
  }

  if (contourPoints.length < 3) {
    // Fallback: return convex hull of stroke points
    return computeConvexHull(strokes);
  }

  // Use convex hull of edge points for a clean polygon
  const hull = computeConvexHull(contourPoints);

  // Simplify the hull to reduce point count
  const simplified = simplifyPolygon(hull, 1.5);

  return simplified;
}
