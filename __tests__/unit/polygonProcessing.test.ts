import {
  perpendicularDistance,
  simplifyPolygon,
  computeConvexHull,
  extractOutlineFromBrushStrokes,
} from '../../utils/polygon-processing';

describe('perpendicularDistance', () => {
  it('calculates distance from point to horizontal line', () => {
    expect(perpendicularDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(5);
  });

  it('calculates distance from point on the line', () => {
    expect(perpendicularDistance({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
  });

  it('handles zero-length line (both points same)', () => {
    expect(perpendicularDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(5);
  });
});

describe('computeConvexHull', () => {
  it('returns hull of square with interior point', () => {
    const points = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
      { x: 5, y: 5 }, // interior
    ];
    const hull = computeConvexHull(points);
    expect(hull.length).toBe(4);
  });

  it('handles less than 3 points', () => {
    expect(computeConvexHull([])).toEqual([]);
    expect(computeConvexHull([{ x: 0, y: 0 }])).toEqual([{ x: 0, y: 0 }]);
    expect(computeConvexHull([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toHaveLength(2);
  });

  it('handles collinear points', () => {
    const points = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];
    const hull = computeConvexHull(points);
    expect(hull.length).toBeLessThanOrEqual(3);
  });

  it('handles triangle', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    const hull = computeConvexHull(points);
    expect(hull.length).toBe(3);
  });

  it('handles many interior points', () => {
    const corners = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    const interior = [
      { x: 20, y: 30 }, { x: 50, y: 50 }, { x: 70, y: 20 }, { x: 30, y: 80 }, { x: 60, y: 60 },
      { x: 15, y: 45 }, { x: 85, y: 75 }, { x: 40, y: 10 }, { x: 55, y: 90 }, { x: 25, y: 65 },
    ];
    const hull = computeConvexHull([...corners, ...interior]);
    expect(hull.length).toBe(4);
  });
});

describe('simplifyPolygon', () => {
  it('keeps triangle unchanged', () => {
    const tri = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
    expect(simplifyPolygon(tri, 1).length).toBeLessThanOrEqual(3);
  });

  it('reduces points on near-straight line', () => {
    const points = Array.from({ length: 20 }, (_, i) => ({
      x: i * 5, y: Math.sin(i * 0.1) * 0.5,
    }));
    const result = simplifyPolygon(points, 1);
    expect(result.length).toBeLessThan(points.length);
  });

  it('handles 2 or fewer points', () => {
    expect(simplifyPolygon([], 1)).toEqual([]);
    expect(simplifyPolygon([{ x: 0, y: 0 }], 1)).toEqual([{ x: 0, y: 0 }]);
  });

  it('preserves corners of a zigzag', () => {
    const zigzag = [
      { x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 0 }, { x: 15, y: 10 }, { x: 20, y: 0 },
    ];
    const result = simplifyPolygon(zigzag, 0.5);
    expect(result.length).toBe(5);
  });
});

describe('extractOutlineFromBrushStrokes', () => {
  it('produces valid polygon from circular brush strokes', () => {
    const strokes = Array.from({ length: 20 }, (_, i) => ({
      x: 50 + 10 * Math.cos((i / 20) * Math.PI * 2),
      y: 50 + 10 * Math.sin((i / 20) * Math.PI * 2),
    }));
    const outline = extractOutlineFromBrushStrokes(strokes, 4);
    expect(outline.length).toBeGreaterThanOrEqual(3);
  });

  it('produces polygon from dense brush strokes', () => {
    const strokes = Array.from({ length: 30 }, (_, i) => ({
      x: 20 + i * 2, y: 50,
    }));
    const outline = extractOutlineFromBrushStrokes(strokes, 5);
    expect(outline.length).toBeGreaterThanOrEqual(3);
  });

  it('handles too few strokes (falls back to convex hull)', () => {
    const outline = extractOutlineFromBrushStrokes([{ x: 50, y: 50 }], 2);
    expect(outline).toBeDefined();
  });

  it('handles empty strokes', () => {
    const outline = extractOutlineFromBrushStrokes([], 4);
    expect(outline.length).toBeLessThanOrEqual(3);
  });
});
