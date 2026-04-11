/**
 * PERF-11: Polygon memoization in RouteOverlay
 *
 * Verifies that the smoothed-polygon path strings rendered by RouteOverlay
 * are stable across re-renders when the relevant props (handHolds,
 * detectedHolds, width, height) have not changed.  A different detectedHolds
 * array must produce different path strings.
 *
 * Strategy
 * --------
 * react-native-svg components are replaced with plain View elements so that
 * react-test-renderer can traverse the tree without native module issues.
 * We capture the `d` props of every Path element after each render and
 * compare them across renders.
 */

import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { HandHold, DetectedHold } from "../../types/database.types";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("react-native-svg", () => {
  const { createElement } = require("react");
  const { View } = require("react-native");
  const wrap =
    (testID: string) =>
    ({ children, ...rest }: any) =>
      createElement(View, { testID, ...rest }, children);
  return {
    __esModule: true,
    default: wrap("Svg"),
    Line: wrap("Line"),
    Path: wrap("Path"),
    Polygon: wrap("Polygon"),
    G: wrap("G"),
    Defs: wrap("Defs"),
    Marker: wrap("Marker"),
    Rect: wrap("Rect"),
    Mask: wrap("Mask"),
  };
});

// ── Import component after mocks ──────────────────────────────────────────────

import RouteOverlay from "../../components/RouteOverlay";

// ── Test data ─────────────────────────────────────────────────────────────────

/** A simple square polygon in percentage coordinates. */
const SQUARE_POLYGON = [
  { x: 10, y: 10 },
  { x: 30, y: 10 },
  { x: 30, y: 30 },
  { x: 10, y: 30 },
];

/** A larger polygon so that re-rendering with a different shape is detectable. */
const TRIANGLE_POLYGON = [
  { x: 50, y: 10 },
  { x: 70, y: 50 },
  { x: 30, y: 50 },
];

function makeDetectedHold(id: string, polygon = SQUARE_POLYGON): DetectedHold {
  return {
    id,
    photo_id: "photo-1",
    polygon,
    center: { x: 20, y: 20 },
    created_at: "2024-01-01T00:00:00Z",
  };
}

function makeHandHold(detectedHoldId: string, order = 1): HandHold {
  return {
    detected_hold_id: detectedHoldId,
    order,
    labelX: 50,
    labelY: 50,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Collect all `d` props from Path mock elements in the rendered tree. */
function collectPathStrings(renderer: ReactTestRenderer): string[] {
  const paths = renderer.root.findAllByProps({ testID: "Path" });
  return paths
    .map((p) => p.props.d as string | undefined)
    .filter((d): d is string => typeof d === "string" && d.length > 0);
}

interface OverlayProps {
  handHolds: HandHold[];
  detectedHolds: DetectedHold[];
  width?: number;
  height?: number;
}

function renderOverlay(props: OverlayProps): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <RouteOverlay
        handHolds={props.handHolds}
        detectedHolds={props.detectedHolds}
        width={props.width ?? 400}
        height={props.height ?? 800}
      />,
    );
  });
  return renderer;
}

function rerender(renderer: ReactTestRenderer, props: OverlayProps): void {
  act(() => {
    renderer.update(
      <RouteOverlay
        handHolds={props.handHolds}
        detectedHolds={props.detectedHolds}
        width={props.width ?? 400}
        height={props.height ?? 800}
      />,
    );
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RouteOverlay — PERF-11: polygon memoization", () => {
  const detectedHold = makeDetectedHold("dh-1", SQUARE_POLYGON);
  const handHold = makeHandHold("dh-1", 1);

  it("renders SVG path strings for a hand hold", () => {
    const renderer = renderOverlay({
      handHolds: [handHold],
      detectedHolds: [detectedHold],
    });

    const paths = collectPathStrings(renderer);
    expect(paths.length).toBeGreaterThan(0);
    // Every path must be a valid SVG path starting with 'M'
    paths.forEach((d) => {
      expect(d).toMatch(/^M /);
    });
  });

  it("produces identical path strings when re-rendered with the same props", () => {
    const props: OverlayProps = {
      handHolds: [handHold],
      detectedHolds: [detectedHold],
    };

    const renderer = renderOverlay(props);
    const pathsAfterFirstRender = collectPathStrings(renderer);

    // Re-render with the exact same prop values (new array/object references to
    // ensure React re-renders the component, simulating an unrelated parent update).
    rerender(renderer, {
      handHolds: [{ ...handHold }],
      detectedHolds: [{ ...detectedHold, polygon: [...SQUARE_POLYGON] }],
    });

    const pathsAfterSecondRender = collectPathStrings(renderer);

    expect(pathsAfterSecondRender).toEqual(pathsAfterFirstRender);
  });

  it("produces different path strings when detectedHolds polygon changes", () => {
    const renderer = renderOverlay({
      handHolds: [handHold],
      detectedHolds: [detectedHold],
    });

    const originalPaths = collectPathStrings(renderer);

    // Re-render with a different polygon shape.
    const changedDetectedHold = makeDetectedHold("dh-1", TRIANGLE_POLYGON);
    rerender(renderer, {
      handHolds: [handHold],
      detectedHolds: [changedDetectedHold],
    });

    const updatedPaths = collectPathStrings(renderer);

    // The path strings must differ because the underlying polygon changed.
    expect(updatedPaths).not.toEqual(originalPaths);
  });

  it("produces different path strings when dimensions change", () => {
    const renderer = renderOverlay({
      handHolds: [handHold],
      detectedHolds: [detectedHold],
      width: 400,
      height: 800,
    });

    const originalPaths = collectPathStrings(renderer);

    rerender(renderer, {
      handHolds: [handHold],
      detectedHolds: [detectedHold],
      width: 800,
      height: 1200,
    });

    const updatedPaths = collectPathStrings(renderer);

    expect(updatedPaths).not.toEqual(originalPaths);
  });

  it("renders only the dark overlay path when handHolds array is empty", () => {
    const renderer = renderOverlay({
      handHolds: [],
      detectedHolds: [detectedHold],
    });

    // With no holds, only the evenodd dark overlay path (outer rectangle) should exist.
    const paths = collectPathStrings(renderer);
    // The dark overlay path is the outer rectangle with no hold holes
    expect(paths.every(p => p.startsWith("M 0 0 L"))).toBe(true);
  });

  it("renders only the dark overlay path when detectedHolds does not contain the referenced hold", () => {
    // handHold references 'dh-1' but detectedHolds has 'dh-99' → no polygon data.
    const renderer = renderOverlay({
      handHolds: [handHold],
      detectedHolds: [makeDetectedHold("dh-99")],
    });

    const paths = collectPathStrings(renderer);
    // Only the dark overlay rectangle, no hold border paths
    expect(paths.every(p => p.startsWith("M 0 0 L"))).toBe(true);
  });
});
