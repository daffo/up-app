/**
 * Checks if a note indicates a dual side (starts with "DX" or "SX").
 * Used for both dual-start and dual-top holds.
 */
export function isDualSideNote(note?: string | null): boolean {
  return !!note && (note.startsWith('DX') || note.startsWith('SX'));
}

/**
 * Returns the display label for a hold's order position.
 * Handles START (with optional DX/SX dual start), TOP (with optional DX/SX dual top), and numeric order.
 */
export function getHoldOrderLabel(index: number, totalHolds: number, note?: string | null): string {
  const isDual = isDualSideNote(note);

  if (index === 0) {
    return isDual && totalHolds >= 3 ? `START ${note}` : 'START';
  }
  if (index === 1 && totalHolds >= 3 && isDual) {
    return `START ${note}`;
  }
  if (totalHolds > 1 && index === totalHolds - 1) {
    return isDual && totalHolds >= 4 ? `TOP ${note}` : 'TOP';
  }
  if (index === totalHolds - 2 && totalHolds >= 4 && isDual) {
    return `TOP ${note}`;
  }
  return `${index + 1}`;
}

/**
 * Returns the full display label for a hold, combining order and note.
 * DX/SX notes on start and top holds are absorbed into the order label and not repeated.
 */
export function getHoldLabel(index: number, totalHolds: number, note?: string | null): string {
  const orderLabel = getHoldOrderLabel(index, totalHolds, note);
  const isStartDual = isDualSideNote(note) && (index === 0 || (index === 1 && totalHolds >= 3));
  const isTopDual = isDualSideNote(note) && totalHolds >= 4 && (index === totalHolds - 1 || index === totalHolds - 2);
  const noteConsumed = isStartDual || isTopDual;

  if (note && !noteConsumed) {
    return `${orderLabel}. ${note}`;
  }
  return orderLabel;
}

/**
 * Whether the start-related quick actions should be shown for a hold.
 */
export function canSetStart(index: number, totalHolds: number): boolean {
  return (index === 0 || index === 1) && totalHolds >= 3;
}

/**
 * Whether the top-related quick actions should be shown for a hold.
 * Requires 4+ holds (start + at least 1 middle + 2 top holds).
 */
export function canSetTop(index: number, totalHolds: number): boolean {
  return (index === totalHolds - 1 || index === totalHolds - 2) && totalHolds >= 4;
}
