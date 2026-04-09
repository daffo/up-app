// Estimated half-sizes in percentage coordinates (0-100 space)
const LABEL_HALF_W = 4;
const LABEL_HALF_H = 1.5;
const HOLD_HALF_W = 3;
const HOLD_HALF_H = 3;

// Spiral parameters
const START_RADIUS = 3;     // % distance for first ring
const RADIUS_GROWTH = 0.5;  // % increase per step
const ANGLE_STEP = Math.PI / 4;  // 45° — 8 positions per revolution
const START_ANGLE = -Math.PI / 4; // upper-right, clockwise
const MAX_TRIES = 36;

function rectsOverlap(
  ax: number, ay: number, aHalfW: number, aHalfH: number,
  bx: number, by: number, bHalfW: number, bHalfH: number,
): boolean {
  return Math.abs(ax - bx) < aHalfW + bHalfW && Math.abs(ay - by) < aHalfH + bHalfH;
}

/**
 * Finds a label position near (holdX, holdY) that doesn't overlap existing
 * labels or hold positions. Sweeps outward in a clockwise spiral starting
 * from the upper-right.
 */
export function findFreeLabelPosition(
  holdX: number,
  holdY: number,
  existingLabels: Array<{ labelX: number; labelY: number }>,
  holdCenters: Array<{ x: number; y: number }> = [],
): { labelX: number; labelY: number } {
  for (let i = 0; i < MAX_TRIES; i++) {
    const angle = START_ANGLE + i * ANGLE_STEP;
    const radius = START_RADIUS + i * RADIUS_GROWTH;
    const cx = Math.max(0, Math.min(100, holdX + radius * Math.cos(angle)));
    const cy = Math.max(0, Math.min(100, holdY + radius * Math.sin(angle)));

    const hitsLabel = existingLabels.some(l =>
      rectsOverlap(cx, cy, LABEL_HALF_W, LABEL_HALF_H, l.labelX, l.labelY, LABEL_HALF_W, LABEL_HALF_H)
    );
    if (hitsLabel) continue;

    const hitsHold = holdCenters.some(h =>
      rectsOverlap(cx, cy, LABEL_HALF_W, LABEL_HALF_H, h.x, h.y, HOLD_HALF_W, HOLD_HALF_H)
    );
    if (hitsHold) continue;

    return { labelX: cx, labelY: cy };
  }

  // All candidates blocked — fall back to default offset
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
