import { isVersionOutdated } from '../../utils/version';

describe('isVersionOutdated', () => {
  it('returns false when versions are equal', () => {
    expect(isVersionOutdated('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns true when current is older (major)', () => {
    expect(isVersionOutdated('0.9.9', '1.0.0')).toBe(true);
  });

  it('returns true when current is older (minor)', () => {
    expect(isVersionOutdated('1.0.9', '1.1.0')).toBe(true);
  });

  it('returns true when current is older (patch)', () => {
    expect(isVersionOutdated('1.0.0', '1.0.1')).toBe(true);
  });

  it('returns false when current is newer', () => {
    expect(isVersionOutdated('2.0.0', '1.0.0')).toBe(false);
    expect(isVersionOutdated('1.1.0', '1.0.9')).toBe(false);
    expect(isVersionOutdated('1.0.2', '1.0.1')).toBe(false);
  });

  it('strips pre-release suffix before comparing', () => {
    expect(isVersionOutdated('0.5.6-beta', '0.6.0')).toBe(true);
    expect(isVersionOutdated('0.6.0-alpha', '0.6.0')).toBe(false);
    expect(isVersionOutdated('1.0.0-rc1', '0.9.0')).toBe(false);
  });

  it('handles 0.0.0 minimum (never blocks)', () => {
    expect(isVersionOutdated('0.0.1', '0.0.0')).toBe(false);
    expect(isVersionOutdated('0.0.0', '0.0.0')).toBe(false);
  });

  it('handles incomplete version strings', () => {
    expect(isVersionOutdated('1', '1.0.1')).toBe(true);
    expect(isVersionOutdated('1.0', '1.0.0')).toBe(false);
  });
});
