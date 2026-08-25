const MIN_LABEL_HALF_W = 4;
const LABEL_HALF_H = 1.5;
const DEFAULT_HOLD_HALF_SIZE = 3;
const START_RADIUS = 3;
const RADIUS_GROWTH = 0.5;
const ANGLES_PER_RING = 16;
const ANGLE_STEP = (Math.PI * 2) / ANGLES_PER_RING;
const START_ANGLE = -Math.PI / 4;
const MAX_RINGS = 36;

type LabelBounds = {
  labelX: number;
  labelY: number;
  labelText?: string;
  halfW?: number;
  halfH?: number;
};

export type HoldBounds = {
  x: number;
  y: number;
  halfW?: number;
  halfH?: number;
};

export function getRouteHoldBounds(
  holds: Array<{ detected_hold_id: string; labelX: number; labelY: number }>,
  detectedHolds: Array<{
    id: string;
    center: { x: number; y: number };
    polygon: Array<{ x: number; y: number }>;
  }>,
): HoldBounds[] {
  const byId = new Map(detectedHolds.map((hold) => [hold.id, hold]));
  return holds.map((hold) => {
    const detected = byId.get(hold.detected_hold_id);
    if (!detected) return { x: hold.labelX, y: hold.labelY };

    return {
      x: detected.center.x,
      y: detected.center.y,
      halfW: Math.max(
        ...detected.polygon.map((point) => Math.abs(point.x - detected.center.x)),
      ),
      halfH: Math.max(
        ...detected.polygon.map((point) => Math.abs(point.y - detected.center.y)),
      ),
    };
  });
}

function labelHalfWidth(labelText = ""): number {
  return Math.max(MIN_LABEL_HALF_W, labelText.length * 0.6);
}

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
  existingLabels: LabelBounds[],
  holdBounds: HoldBounds[] = [],
  labelText = "",
): { labelX: number; labelY: number } {
  const halfW = labelHalfWidth(labelText);
  const clampX = (x: number) => Math.max(halfW, Math.min(100 - halfW, x));
  const clampY = (y: number) => Math.max(LABEL_HALF_H, Math.min(100 - LABEL_HALF_H, y));

  for (let ring = 0; ring < MAX_RINGS; ring++) {
    const radius = START_RADIUS + ring * RADIUS_GROWTH;
    for (let step = 0; step < ANGLES_PER_RING; step++) {
      const angle = START_ANGLE + step * ANGLE_STEP;
      const cx = clampX(holdX + radius * Math.cos(angle));
      const cy = clampY(holdY + radius * Math.sin(angle));

      const hitsLabel = existingLabels.some((label) =>
        rectsOverlap(
          cx,
          cy,
          halfW,
          LABEL_HALF_H,
          label.labelX,
          label.labelY,
          label.halfW ?? labelHalfWidth(label.labelText),
          label.halfH ?? LABEL_HALF_H,
        ),
      );
      if (hitsLabel) continue;

      const hitsHold = holdBounds.some((hold) =>
        rectsOverlap(
          cx,
          cy,
          halfW,
          LABEL_HALF_H,
          hold.x,
          hold.y,
          hold.halfW ?? DEFAULT_HOLD_HALF_SIZE,
          hold.halfH ?? DEFAULT_HOLD_HALF_SIZE,
        ),
      );
      if (!hitsHold) return { labelX: cx, labelY: cy };
    }
  }

  return { labelX: clampX(holdX + 3), labelY: clampY(holdY - 3) };
}

/**
 * Reflows all labels so none overlap each other or hold centers.
 * Processes holds in order; each label is placed via spiral search
 * against already-settled labels.
 */
export function resolveAllLabelOverlaps<H extends { labelX: number; labelY: number; labelPinned?: boolean }>(
  holds: H[],
  holdBounds: HoldBounds[],
  labelTexts: string[] = [],
): H[] {
  const settled: LabelBounds[] = holds.flatMap((hold, index) =>
    hold.labelPinned ? [{ ...hold, labelText: labelTexts[index] }] : [],
  );

  return holds.map((hold, index) => {
    if (hold.labelPinned) return hold;

    const center = holdBounds[index] ?? { x: hold.labelX, y: hold.labelY };
    const labelText = labelTexts[index] ?? "";
    const position = findFreeLabelPosition(
      center.x,
      center.y,
      settled,
      holdBounds,
      labelText,
    );
    const updated =
      position.labelX === hold.labelX && position.labelY === hold.labelY
        ? hold
        : { ...hold, ...position };
    settled.push({ ...updated, labelText });
    return updated;
  });
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
