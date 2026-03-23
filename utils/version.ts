/**
 * Parse a version string like "0.5.6-beta" into comparable parts.
 * Strips any pre-release suffix for comparison purposes.
 */
function parseVersion(version: string): [number, number, number] {
  const clean = version.split('-')[0];
  const parts = clean.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

/**
 * Returns true if `current` is older than `minimum`.
 * Example: isVersionOutdated("0.5.6-beta", "0.6.0") => true
 */
export function isVersionOutdated(current: string, minimum: string): boolean {
  const [curMajor, curMinor, curPatch] = parseVersion(current);
  const [minMajor, minMinor, minPatch] = parseVersion(minimum);

  if (curMajor !== minMajor) return curMajor < minMajor;
  if (curMinor !== minMinor) return curMinor < minMinor;
  return curPatch < minPatch;
}
