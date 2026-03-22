import {
  clampFocusRegion,
  filterHoldsInRegion,
  mapHoldsToFocusRegion,
  applyMoveDelta,
  focusCoordsToImageCoords,
  calculateCentroid,
} from '../../utils/focus-region';

describe('clampFocusRegion', () => {
  it('centers region when fully within bounds', () => {
    const region = clampFocusRegion(50, 50, 20);
    expect(region).toEqual({ x: 40, y: 40, width: 20, height: 20 });
  });

  it('shifts region when near left edge', () => {
    const region = clampFocusRegion(5, 50, 20);
    expect(region.x).toBe(0);
    expect(region.width).toBe(20);
  });

  it('shifts region when near right edge', () => {
    const region = clampFocusRegion(95, 50, 20);
    expect(region.x + region.width).toBe(100);
  });

  it('shifts region when near top edge', () => {
    const region = clampFocusRegion(50, 5, 20);
    expect(region.y).toBe(0);
  });

  it('shifts region when near bottom edge', () => {
    const region = clampFocusRegion(50, 95, 20);
    expect(region.y + region.height).toBe(100);
  });

  it('handles corner case (both edges)', () => {
    const region = clampFocusRegion(5, 95, 20);
    expect(region.x).toBe(0);
    expect(region.y + region.height).toBe(100);
  });
});

describe('filterHoldsInRegion', () => {
  const holds = [
    { id: 'a', polygon: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 15, y: 20 }] },
    { id: 'b', polygon: [{ x: 60, y: 60 }, { x: 70, y: 60 }, { x: 65, y: 70 }] },
    { id: 'c', polygon: [{ x: 90, y: 90 }, { x: 95, y: 90 }, { x: 92, y: 95 }] },
  ];
  const region = { x: 0, y: 0, width: 50, height: 50 };

  it('returns holds whose center is in the region', () => {
    const result = filterHoldsInRegion(holds, region);
    expect(result.map((h: any) => h.id)).toEqual(['a']);
  });

  it('returns empty array when no holds in region', () => {
    const result = filterHoldsInRegion(holds, { x: 40, y: 40, width: 10, height: 10 });
    expect(result).toEqual([]);
  });
});

describe('mapHoldsToFocusRegion', () => {
  it('maps coordinates from image space to focus region space', () => {
    const hold = {
      polygon: [{ x: 25, y: 25 }, { x: 50, y: 25 }, { x: 37.5, y: 50 }],
      center: { x: 37.5, y: 33.3 },
    };
    const region = { x: 0, y: 0, width: 50, height: 50 };
    const [mapped] = mapHoldsToFocusRegion([hold], region);
    // x=25 in region 0-50 → (25/50)*100 = 50%
    expect(mapped.polygon[0].x).toBeCloseTo(50);
    expect(mapped.polygon[0].y).toBeCloseTo(50);
  });
});

describe('applyMoveDelta', () => {
  it('offsets polygon and center', () => {
    const hold = {
      polygon: [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 15, y: 20 }],
      center: { x: 15, y: 13.3 },
    };
    const moved = applyMoveDelta(hold, { x: 5, y: -3 });
    expect(moved.polygon[0]).toEqual({ x: 15, y: 7 });
    expect(moved.center.x).toBeCloseTo(20);
  });
});

describe('focusCoordsToImageCoords', () => {
  it('converts focus region coordinates to image coordinates', () => {
    const polygon = [{ x: 50, y: 50 }]; // center of focus view
    const region = { x: 20, y: 30, width: 40, height: 20 };
    const [result] = focusCoordsToImageCoords(polygon, region);
    // x: 20 + (50/100) * 40 = 40
    // y: 30 + (50/100) * 20 = 40
    expect(result.x).toBeCloseTo(40);
    expect(result.y).toBeCloseTo(40);
  });
});

describe('calculateCentroid', () => {
  it('calculates center of a square', () => {
    const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const center = calculateCentroid(polygon);
    expect(center.x).toBeCloseTo(5);
    expect(center.y).toBeCloseTo(5);
  });

  it('handles empty polygon', () => {
    const center = calculateCentroid([]);
    expect(center).toEqual({ x: 0, y: 0 });
  });
});
