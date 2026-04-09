import {
  isDualSideNote,
  getHoldOrderLabel,
  getHoldLabel,
  getFootHoldLabel,
  canSetStart,
  canSetTop,
  findFreeLabelPosition,
  resolveAllLabelOverlaps,
} from '../../utils/holds';

describe('isDualSideNote', () => {
  it('returns true for "DX"', () => {
    expect(isDualSideNote('DX')).toBe(true);
  });

  it('returns true for "DX something"', () => {
    expect(isDualSideNote('DX something')).toBe(true);
  });

  it('returns true for "SX"', () => {
    expect(isDualSideNote('SX')).toBe(true);
  });

  it('returns true for "SX something"', () => {
    expect(isDualSideNote('SX something')).toBe(true);
  });

  it('returns false for null', () => {
    expect(isDualSideNote(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isDualSideNote(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDualSideNote('')).toBe(false);
  });

  it('returns false for other text', () => {
    expect(isDualSideNote('other text')).toBe(false);
  });

  it('returns false for lowercase "dx"', () => {
    expect(isDualSideNote('dx')).toBe(false);
  });
});

describe('getHoldOrderLabel', () => {
  it('returns "START" for index 0 with no dual note', () => {
    expect(getHoldOrderLabel(0, 5)).toBe('START');
  });

  it('returns "START DX" for index 0 with "DX" note and totalHolds >= 3', () => {
    expect(getHoldOrderLabel(0, 3, 'DX')).toBe('START DX');
  });

  it('returns "START" for index 0 with "DX" note but totalHolds < 3', () => {
    expect(getHoldOrderLabel(0, 2, 'DX')).toBe('START');
  });

  it('returns "START SX" for index 1 with "SX" note and totalHolds >= 3', () => {
    expect(getHoldOrderLabel(1, 3, 'SX')).toBe('START SX');
  });

  it('returns numeric "2" for index 1 without dual note', () => {
    expect(getHoldOrderLabel(1, 5)).toBe('2');
  });

  it('returns "TOP" for last index when totalHolds > 1', () => {
    expect(getHoldOrderLabel(4, 5)).toBe('TOP');
  });

  it('returns numeric string for middle index', () => {
    expect(getHoldOrderLabel(2, 5)).toBe('3');
  });

  it('returns "START" for single hold (totalHolds = 1)', () => {
    expect(getHoldOrderLabel(0, 1)).toBe('START');
  });

  // Dual top tests
  it('returns "TOP DX" for last hold with "DX" note and totalHolds >= 4', () => {
    expect(getHoldOrderLabel(3, 4, 'DX')).toBe('TOP DX');
  });

  it('returns "TOP SX" for second-to-last hold with "SX" note and totalHolds >= 4', () => {
    expect(getHoldOrderLabel(2, 4, 'SX')).toBe('TOP SX');
  });

  it('returns "TOP" for last hold with "DX" note but totalHolds < 4', () => {
    expect(getHoldOrderLabel(2, 3, 'DX')).toBe('TOP');
  });

  it('returns numeric for second-to-last with "DX" note but totalHolds < 4', () => {
    expect(getHoldOrderLabel(1, 3, 'DX')).toBe('START DX');
  });

  it('returns "TOP DX" and "TOP SX" for dual top in 5-hold route', () => {
    expect(getHoldOrderLabel(3, 5, 'SX')).toBe('TOP SX');
    expect(getHoldOrderLabel(4, 5, 'DX')).toBe('TOP DX');
  });
});

describe('getHoldLabel', () => {
  it('consumes DX note on start hold (index 0)', () => {
    expect(getHoldLabel(0, 3, 'DX')).toBe('START DX');
  });

  it('consumes SX note on second start hold (index 1 with totalHolds >= 3)', () => {
    expect(getHoldLabel(1, 3, 'SX')).toBe('START SX');
  });

  it('appends regular note on non-start hold', () => {
    expect(getHoldLabel(2, 5, 'crimp')).toBe('3 crimp');
  });

  it('returns just order label when no note', () => {
    expect(getHoldLabel(0, 5)).toBe('START');
  });

  it('appends non-DX/SX note on start hold', () => {
    expect(getHoldLabel(0, 5, 'crimp')).toBe('START crimp');
  });

  // Dual top label tests
  it('consumes DX note on last hold (dual top)', () => {
    expect(getHoldLabel(3, 4, 'DX')).toBe('TOP DX');
  });

  it('consumes SX note on second-to-last hold (dual top)', () => {
    expect(getHoldLabel(2, 4, 'SX')).toBe('TOP SX');
  });

  it('appends regular note on top hold', () => {
    expect(getHoldLabel(3, 4, 'match')).toBe('TOP match');
  });

  it('does not consume DX note on top hold when totalHolds < 4', () => {
    expect(getHoldLabel(2, 3, 'DX')).toBe('TOP DX');
  });
});

describe('canSetStart', () => {
  it('returns true for index 0 with totalHolds >= 3', () => {
    expect(canSetStart(0, 3)).toBe(true);
  });

  it('returns true for index 1 with totalHolds >= 3', () => {
    expect(canSetStart(1, 3)).toBe(true);
  });

  it('returns false for index 2 with totalHolds >= 3', () => {
    expect(canSetStart(2, 3)).toBe(false);
  });

  it('returns false for index 0 with totalHolds < 3', () => {
    expect(canSetStart(0, 1)).toBe(false);
  });

  it('returns false for index 0 with totalHolds = 2', () => {
    expect(canSetStart(0, 2)).toBe(false);
  });
});

describe('canSetTop', () => {
  it('returns true for last index with totalHolds >= 4', () => {
    expect(canSetTop(3, 4)).toBe(true);
  });

  it('returns true for second-to-last index with totalHolds >= 4', () => {
    expect(canSetTop(2, 4)).toBe(true);
  });

  it('returns false for middle index with totalHolds >= 4', () => {
    expect(canSetTop(1, 4)).toBe(false);
  });

  it('returns false for last index with totalHolds < 4', () => {
    expect(canSetTop(2, 3)).toBe(false);
  });

  it('returns false for last index with totalHolds = 2', () => {
    expect(canSetTop(1, 2)).toBe(false);
  });

  it('returns true for both top holds in a 5-hold route', () => {
    expect(canSetTop(3, 5)).toBe(true);
    expect(canSetTop(4, 5)).toBe(true);
  });
});

describe('getFootHoldLabel', () => {
  it('returns "Foot" when no note', () => {
    expect(getFootHoldLabel()).toBe('Foot');
  });

  it('returns "Foot" when note is null', () => {
    expect(getFootHoldLabel(null)).toBe('Foot');
  });

  it('returns "Foot" when note is empty string', () => {
    expect(getFootHoldLabel('')).toBe('Foot');
  });

  it('returns "Foot — crimp" when note is "crimp"', () => {
    expect(getFootHoldLabel('crimp')).toBe('Foot — crimp');
  });

  it('returns "Foot — small edge" when note is "small edge"', () => {
    expect(getFootHoldLabel('small edge')).toBe('Foot — small edge');
  });
});

describe('findFreeLabelPosition', () => {
  const noOverlapWith = (
    result: { labelX: number; labelY: number },
    obstacles: Array<{ x: number; y: number; halfW: number; halfH: number }>,
  ) => obstacles.every(o =>
    !(Math.abs(result.labelX - o.x) < 4 + o.halfW && Math.abs(result.labelY - o.y) < 1.5 + o.halfH)
  );

  it('places label in upper-right area when no obstacles', () => {
    const result = findFreeLabelPosition(50, 50, []);
    // First spiral position: radius=3, angle=-45° → upper-right quadrant
    expect(result.labelX).toBeGreaterThan(50);
    expect(result.labelY).toBeLessThan(50);
  });

  it('spirals past a blocked position', () => {
    const first = findFreeLabelPosition(50, 50, []);
    // Block the first result
    const result = findFreeLabelPosition(50, 50, [first]);
    expect(noOverlapWith(result, [{ x: first.labelX, y: first.labelY, halfW: 4, halfH: 1.5 }])).toBe(true);
  });

  it('finds a free spot among many labels', () => {
    const labels = [
      { labelX: 53, labelY: 47 },
      { labelX: 47, labelY: 47 },
      { labelX: 53, labelY: 53 },
      { labelX: 47, labelY: 53 },
    ];
    const result = findFreeLabelPosition(50, 50, labels);
    expect(noOverlapWith(result, labels.map(l => ({ x: l.labelX, y: l.labelY, halfW: 4, halfH: 1.5 })))).toBe(true);
  });

  it('avoids hold centers', () => {
    const holds = [{ x: 52, y: 48 }];
    const result = findFreeLabelPosition(50, 50, [], holds);
    expect(noOverlapWith(result, [{ x: 52, y: 48, halfW: 3, halfH: 3 }])).toBe(true);
  });

  it('avoids both labels and hold centers', () => {
    const labels = [{ labelX: 47, labelY: 47 }];
    const holds = [{ x: 53, y: 47 }];
    const result = findFreeLabelPosition(50, 50, labels, holds);
    expect(noOverlapWith(result, [
      { x: 47, y: 47, halfW: 4, halfH: 1.5 },
      { x: 53, y: 47, halfW: 3, halfH: 3 },
    ])).toBe(true);
  });

  it('clamps within 0-100 bounds', () => {
    const resultLeft = findFreeLabelPosition(1, 50, []);
    expect(resultLeft.labelX).toBeGreaterThanOrEqual(0);
    const resultTop = findFreeLabelPosition(50, 1, []);
    expect(resultTop.labelY).toBeGreaterThanOrEqual(0);
    const resultRight = findFreeLabelPosition(99, 50, []);
    expect(resultRight.labelX).toBeLessThanOrEqual(100);
  });

  it('falls back to default when all spiral positions are blocked', () => {
    // Generate blockers at every spiral position
    const blockers: Array<{ labelX: number; labelY: number }> = [];
    for (let i = 0; i < 36; i++) {
      const angle = -Math.PI / 4 + i * (Math.PI / 4);
      const radius = 3 + i * 0.5;
      blockers.push({
        labelX: 50 + radius * Math.cos(angle),
        labelY: 50 + radius * Math.sin(angle),
      });
    }
    const result = findFreeLabelPosition(50, 50, blockers);
    // Falls back to default offset
    expect(result).toEqual({ labelX: 53, labelY: 47 });
  });
});

describe('resolveAllLabelOverlaps', () => {
  const noOverlaps = (holds: Array<{ labelX: number; labelY: number }>) => {
    for (let i = 0; i < holds.length; i++) {
      for (let j = i + 1; j < holds.length; j++) {
        if (Math.abs(holds[i].labelX - holds[j].labelX) < 8 &&
            Math.abs(holds[i].labelY - holds[j].labelY) < 3) return false;
      }
    }
    return true;
  };

  it('places each label near its hold center', () => {
    const holds = [
      { labelX: 99, labelY: 99 },
      { labelX: 99, labelY: 99 },
    ];
    const centers = [{ x: 10, y: 10 }, { x: 30, y: 30 }];
    const result = resolveAllLabelOverlaps(holds, centers);
    // Labels end up near their hold centers, not at original (99,99)
    expect(Math.abs(result[0].labelX - 10)).toBeLessThan(15);
    expect(Math.abs(result[1].labelX - 30)).toBeLessThan(15);
  });

  it('repositions overlapping labels', () => {
    const holds = [
      { labelX: 50, labelY: 50 },
      { labelX: 51, labelY: 50 },
    ];
    const centers = [{ x: 47, y: 53 }, { x: 48, y: 53 }];
    const result = resolveAllLabelOverlaps(holds, centers);
    expect(noOverlaps(result)).toBe(true);
  });

  it('handles three-way overlaps', () => {
    const holds = [
      { labelX: 50, labelY: 50 },
      { labelX: 51, labelY: 50 },
      { labelX: 52, labelY: 50 },
    ];
    const centers = [{ x: 47, y: 53 }, { x: 48, y: 53 }, { x: 49, y: 53 }];
    const result = resolveAllLabelOverlaps(holds, centers);
    expect(noOverlaps(result)).toBe(true);
  });

  it('does not mutate original array', () => {
    const holds = [
      { labelX: 50, labelY: 50 },
      { labelX: 51, labelY: 50 },
    ];
    const origLabel = holds[1].labelX;
    resolveAllLabelOverlaps(holds, []);
    expect(holds[1].labelX).toBe(origLabel);
  });

  it('does not move pinned labels', () => {
    const holds = [
      { labelX: 50, labelY: 50 },
      { labelX: 51, labelY: 50, labelPinned: true as const },
    ];
    const centers = [{ x: 47, y: 53 }, { x: 48, y: 53 }];
    const result = resolveAllLabelOverlaps(holds, centers);
    // Pinned label stays exactly where it is
    expect(result[1].labelX).toBe(51);
    expect(result[1].labelY).toBe(50);
    // Unpinned label gets repositioned to avoid the pinned one
    expect(result[0].labelX).not.toBe(50);
  });
});
