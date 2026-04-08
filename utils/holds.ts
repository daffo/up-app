// Estimated label half-size in percentage coordinates (0-100 space)
const LABEL_HALF_W = 4;
const LABEL_HALF_H = 1.5;

// Candidate offsets ordered by preference: close first, then farther out
const CANDIDATE_OFFSETS = [
  { x: 3, y: -3 },   { x: -3, y: -3 },  { x: 3, y: 3 },    { x: -3, y: 3 },
  { x: 5, y: 0 },    { x: -5, y: 0 },   { x: 0, y: -5 },   { x: 0, y: 5 },
  { x: 6, y: -5 },   { x: -6, y: -5 },  { x: 6, y: 5 },    { x: -6, y: 5 },
  { x: 8, y: 0 },    { x: -8, y: 0 },   { x: 0, y: -8 },   { x: 0, y: 8 },
];

function labelsOverlap(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) < LABEL_HALF_W * 2 && Math.abs(ay - by) < LABEL_HALF_H * 2;
}

/**
 * Finds a label position near (holdX, holdY) that doesn't overlap existing labels.
 * Tries multiple candidate offsets and returns the first free one.
 */
export function findFreeLabelPosition(
  holdX: number,
  holdY: number,
  existingLabels: Array<{ labelX: number; labelY: number }>,
): { labelX: number; labelY: number } {
  for (const offset of CANDIDATE_OFFSETS) {
    const candidateX = Math.max(0, Math.min(100, holdX + offset.x));
    const candidateY = Math.max(0, Math.min(100, holdY + offset.y));

    const hasOverlap = existingLabels.some(label =>
      labelsOverlap(candidateX, candidateY, label.labelX, label.labelY)
    );

    if (!hasOverlap) {
      return { labelX: candidateX, labelY: candidateY };
    }
  }

  // All candidates overlap — fall back to default offset
  return {
    labelX: Math.max(0, Math.min(100, holdX + 3)),
    labelY: Math.max(0, Math.min(100, holdY - 3)),
  };
}

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
    return `${orderLabel} ${note}`;
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
 * Returns the display label for a foot hold.
 * Shows "Foot" (no note) or "Foot — {note}" (when note is set).
 */
export function getFootHoldLabel(note?: string | null): string {
  if (note) {
    return `Foot — ${note}`;
  }
  return 'Foot';
}

/**
 * Whether the top-related quick actions should be shown for a hold.
 * Requires 4+ holds (start + at least 1 middle + 2 top holds).
 */
export function canSetTop(index: number, totalHolds: number): boolean {
  return (index === totalHolds - 1 || index === totalHolds - 2) && totalHolds >= 4;
}
