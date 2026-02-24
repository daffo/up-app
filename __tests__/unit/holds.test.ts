import {
  isDualStartNote,
  getHoldOrderLabel,
  getHoldLabel,
  canSetStart,
} from '../../utils/holds';

describe('isDualStartNote', () => {
  it('returns true for "DX"', () => {
    expect(isDualStartNote('DX')).toBe(true);
  });

  it('returns true for "DX something"', () => {
    expect(isDualStartNote('DX something')).toBe(true);
  });

  it('returns true for "SX"', () => {
    expect(isDualStartNote('SX')).toBe(true);
  });

  it('returns true for "SX something"', () => {
    expect(isDualStartNote('SX something')).toBe(true);
  });

  it('returns false for null', () => {
    expect(isDualStartNote(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isDualStartNote(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isDualStartNote('')).toBe(false);
  });

  it('returns false for other text', () => {
    expect(isDualStartNote('other text')).toBe(false);
  });

  it('returns false for lowercase "dx"', () => {
    expect(isDualStartNote('dx')).toBe(false);
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
});

describe('getHoldLabel', () => {
  it('consumes DX note on start hold (index 0)', () => {
    expect(getHoldLabel(0, 3, 'DX')).toBe('START DX');
  });

  it('consumes SX note on second start hold (index 1 with totalHolds >= 3)', () => {
    expect(getHoldLabel(1, 3, 'SX')).toBe('START SX');
  });

  it('appends regular note on non-start hold', () => {
    expect(getHoldLabel(2, 5, 'crimp')).toBe('3. crimp');
  });

  it('returns just order label when no note', () => {
    expect(getHoldLabel(0, 5)).toBe('START');
  });

  it('appends non-DX/SX note on start hold', () => {
    expect(getHoldLabel(0, 5, 'crimp')).toBe('START. crimp');
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
