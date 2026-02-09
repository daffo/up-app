/**
 * Checks if a note indicates a dual-start side (starts with "DX" or "SX").
 */
export function isDualStartNote(note?: string | null): boolean {
  return !!note && (note.startsWith('DX') || note.startsWith('SX'));
}

/**
 * Returns the display label for a hold's order position.
 * Handles START (with optional DX/SX dual start), TOP, and numeric order.
 */
export function getHoldOrderLabel(index: number, totalHolds: number, note?: string | null): string {
  const isDual = isDualStartNote(note);

  if (index === 0) {
    return isDual && totalHolds >= 3 ? `START ${note}` : 'START';
  }
  if (index === 1 && totalHolds >= 3 && isDual) {
    return `START ${note}`;
  }
  if (totalHolds > 1 && index === totalHolds - 1) return 'TOP';
  return `${index + 1}`;
}

/**
 * Returns the full display label for a hold, combining order and note.
 * DX/SX notes on start holds are absorbed into the order label and not repeated.
 */
export function getHoldLabel(index: number, totalHolds: number, note?: string | null): string {
  const orderLabel = getHoldOrderLabel(index, totalHolds, note);
  const noteConsumed = isDualStartNote(note) && (index === 0 || (index === 1 && totalHolds >= 3));

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
