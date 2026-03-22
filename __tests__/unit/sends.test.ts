import { getDifficultyLabel } from '../../utils/sends';

describe('getDifficultyLabel', () => {
  it('returns "Soft" for -1', () => {
    expect(getDifficultyLabel(-1)).toBe('Soft');
  });

  it('returns "Accurate" for 0', () => {
    expect(getDifficultyLabel(0)).toBe('Accurate');
  });

  it('returns "Hard" for 1', () => {
    expect(getDifficultyLabel(1)).toBe('Hard');
  });

  it('returns null for null', () => {
    expect(getDifficultyLabel(null)).toBeNull();
  });

  it('returns null for unexpected values', () => {
    expect(getDifficultyLabel(2)).toBeNull();
    expect(getDifficultyLabel(-2)).toBeNull();
  });
});
