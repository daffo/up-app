/**
 * Parse the "main" number of a French sport grade from a free-text string.
 * Only the leading integer matters for badges — letters (a/b/c) and "+" are
 * ignored. Non-French systems (e.g. V-scale "V5") and unparseable input yield
 * null and earn no grade badge.
 *
 * Canonical parse: the SQL in migration-018 mirrors this exact regex
 * (`^\s*([0-9]+)`). Keep the two in sync.
 */
export function parseFrenchGradeNumber(
  grade: string | null | undefined,
): number | null {
  if (!grade) return null;
  const match = grade.match(/^\s*(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
