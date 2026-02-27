import {
  isDualSideNote,
  getHoldOrderLabel,
  getHoldLabel,
  canSetStart,
  canSetTop,
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
