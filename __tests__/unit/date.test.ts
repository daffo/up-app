import { formatDate, formatRelativeDate } from '../../utils/date';

describe('formatDate', () => {
  it('formats a date string to locale date', () => {
    const result = formatDate('2024-06-15T12:00:00Z');
    // The exact format depends on locale, but it should be a non-empty string
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles ISO date strings', () => {
    const result = formatDate('2024-01-01T00:00:00.000Z');
    expect(typeof result).toBe('string');
  });
});

describe('formatRelativeDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "Just now" for dates less than 1 minute ago', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    jest.setSystemTime(now);

    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000).toISOString();
    expect(formatRelativeDate(thirtySecondsAgo)).toBe('Just now');
  });

  it('returns "Xm ago" for dates less than 1 hour ago', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    jest.setSystemTime(now);

    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeDate(fiveMinutesAgo)).toBe('5m ago');

    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    expect(formatRelativeDate(thirtyMinutesAgo)).toBe('30m ago');
  });

  it('returns "Xh ago" for dates less than 24 hours ago', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    jest.setSystemTime(now);

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(twoHoursAgo)).toBe('2h ago');

    const twentyThreeHoursAgo = new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(twentyThreeHoursAgo)).toBe('23h ago');
  });

  it('returns "Yesterday" for dates between 24-48 hours ago', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    jest.setSystemTime(now);

    const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(thirtyHoursAgo)).toBe('Yesterday');
  });

  it('returns absolute date for dates 2+ days ago', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    jest.setSystemTime(now);

    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeDate(threeDaysAgo);
    // Should be an absolute date, not a relative one
    expect(result).not.toContain('ago');
    expect(result).not.toBe('Yesterday');
    expect(result).not.toBe('Just now');
  });

  it('handles edge case at exactly 1 minute', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    jest.setSystemTime(now);

    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
    expect(formatRelativeDate(oneMinuteAgo)).toBe('1m ago');
  });

  it('handles edge case at exactly 1 hour', () => {
    const now = new Date('2024-06-15T12:00:00Z');
    jest.setSystemTime(now);

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    expect(formatRelativeDate(oneHourAgo)).toBe('1h ago');
  });
});
