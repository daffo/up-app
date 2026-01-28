import {
  Point,
  isPointInPolygon,
  calculatePolygonArea,
  findPolygonsAtPoint,
  findSmallestPolygonAtPoint,
} from '../../utils/polygon';

describe('isPointInPolygon', () => {
  // Simple square: (0,0), (10,0), (10,10), (0,10)
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('returns true for point inside polygon', () => {
    expect(isPointInPolygon(5, 5, square)).toBe(true);
  });

  it('returns true for point near edge but inside', () => {
    expect(isPointInPolygon(1, 1, square)).toBe(true);
    expect(isPointInPolygon(9, 9, square)).toBe(true);
  });

  it('returns false for point outside polygon', () => {
    expect(isPointInPolygon(15, 5, square)).toBe(false);
    expect(isPointInPolygon(-5, 5, square)).toBe(false);
    expect(isPointInPolygon(5, 15, square)).toBe(false);
    expect(isPointInPolygon(5, -5, square)).toBe(false);
  });

  it('handles point at corner (edge case)', () => {
    // Note: Corner behavior varies by ray casting implementation
    // This implementation considers corners as inside
    expect(isPointInPolygon(0, 0, square)).toBe(true);
  });

  it('handles triangle polygon', () => {
    const triangle: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(isPointInPolygon(5, 3, triangle)).toBe(true);
    expect(isPointInPolygon(1, 8, triangle)).toBe(false);
  });

  it('handles concave polygon', () => {
    // L-shaped polygon
    const lShape: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(isPointInPolygon(2, 2, lShape)).toBe(true);  // inside bottom-left
    expect(isPointInPolygon(2, 8, lShape)).toBe(true);  // inside top-left
    expect(isPointInPolygon(8, 8, lShape)).toBe(false); // outside the "cut"
  });

  it('handles empty polygon', () => {
    expect(isPointInPolygon(5, 5, [])).toBe(false);
  });

  it('handles single point polygon', () => {
    expect(isPointInPolygon(0, 0, [{ x: 0, y: 0 }])).toBe(false);
  });

  it('handles line (2 points) polygon', () => {
    expect(isPointInPolygon(5, 0, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(false);
  });
});

describe('calculatePolygonArea', () => {
  it('calculates area of a unit square', () => {
    const unitSquare: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(calculatePolygonArea(unitSquare)).toBe(1);
  });

  it('calculates area of a 10x10 square', () => {
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(calculatePolygonArea(square)).toBe(100);
  });

  it('calculates area of a rectangle', () => {
    const rectangle: Point[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(calculatePolygonArea(rectangle)).toBe(200);
  });

  it('calculates area of a triangle', () => {
    // Triangle with base 10, height 10 -> area = 50
    const triangle: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 10 },
    ];
    expect(calculatePolygonArea(triangle)).toBe(50);
  });

  it('works regardless of winding order (clockwise vs counter-clockwise)', () => {
    const clockwise: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const counterClockwise: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
    ];
    expect(calculatePolygonArea(clockwise)).toBe(calculatePolygonArea(counterClockwise));
  });

  it('returns 0 for polygon with less than 3 points', () => {
    expect(calculatePolygonArea([])).toBe(0);
    expect(calculatePolygonArea([{ x: 0, y: 0 }])).toBe(0);
    expect(calculatePolygonArea([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe(0);
  });

  it('handles polygon not at origin', () => {
    const offsetSquare: Point[] = [
      { x: 50, y: 50 },
      { x: 60, y: 50 },
      { x: 60, y: 60 },
      { x: 50, y: 60 },
    ];
    expect(calculatePolygonArea(offsetSquare)).toBe(100);
  });
});

describe('findPolygonsAtPoint', () => {
  const smallSquare = {
    id: 'small',
    polygon: [
      { x: 4, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 6 },
      { x: 4, y: 6 },
    ],
  };

  const mediumSquare = {
    id: 'medium',
    polygon: [
      { x: 2, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 8 },
      { x: 2, y: 8 },
    ],
  };

  const largeSquare = {
    id: 'large',
    polygon: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
  };

  const separateSquare = {
    id: 'separate',
    polygon: [
      { x: 20, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 30 },
      { x: 20, y: 30 },
    ],
  };

  const items = [largeSquare, smallSquare, mediumSquare, separateSquare];

  it('returns matching polygons sorted by area (smallest first)', () => {
    const result = findPolygonsAtPoint(5, 5, items);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('small');
    expect(result[1].id).toBe('medium');
    expect(result[2].id).toBe('large');
  });

  it('returns empty array when no polygons contain the point', () => {
    const result = findPolygonsAtPoint(100, 100, items);
    expect(result).toHaveLength(0);
  });

  it('returns single polygon when only one matches', () => {
    const result = findPolygonsAtPoint(25, 25, items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('separate');
  });

  it('handles empty items array', () => {
    const result = findPolygonsAtPoint(5, 5, []);
    expect(result).toHaveLength(0);
  });
});

describe('findSmallestPolygonAtPoint', () => {
  const small = {
    id: 'small',
    polygon: [
      { x: 4, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 6 },
      { x: 4, y: 6 },
    ],
  };

  const large = {
    id: 'large',
    polygon: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
  };

  it('returns the smallest polygon containing the point', () => {
    const result = findSmallestPolygonAtPoint(5, 5, [large, small]);
    expect(result?.id).toBe('small');
  });

  it('returns null when no polygon contains the point', () => {
    const result = findSmallestPolygonAtPoint(100, 100, [large, small]);
    expect(result).toBeNull();
  });

  it('returns the only matching polygon', () => {
    const result = findSmallestPolygonAtPoint(1, 1, [large, small]);
    expect(result?.id).toBe('large');
  });

  it('handles empty items array', () => {
    const result = findSmallestPolygonAtPoint(5, 5, []);
    expect(result).toBeNull();
  });
});
