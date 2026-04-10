import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, {
  Line,
  Defs,
  Marker,
  Polygon,
  G,
  Path,
  Rect,
  Mask,
} from "react-native-svg";
import {
  Hold,
  HandHold,
  FootHold,
  DetectedHold,
} from "../types/database.types";
import { calculatePolygonArea } from "../utils/polygon";
import { getHoldLabel } from "../utils/holds";

interface RouteOverlayProps {
  handHolds: HandHold[];
  footHolds?: FootHold[];
  detectedHolds: DetectedHold[]; // All detected holds for this photo
  width: number;
  height: number;
  pointerEvents?: "none" | "box-none" | "auto";
  onHandHoldPress?: (index: number) => void;
  onFootHoldPress?: (index: number) => void;
  resizingHoldIndex?: number | null;
  showLabels?: boolean; // Whether to show labels and arrows (default: true)
  selectedHoldId?: string | null; // ID of currently selected hold for highlighting
  zoomScale?: number; // Zoom level to adjust smoothing (default: 1)
}

// Helper function to convert polygon percentage coordinates to pixels
const polygonToPixels = (
  polygon: Array<{ x: number; y: number }>,
  width: number,
  height: number,
): Array<{ x: number; y: number }> => {
  return polygon.map((p) => ({
    x: (p.x / 100) * width,
    y: (p.y / 100) * height,
  }));
};

// Helper function to expand polygon outward by a given number of pixels and optional scale
const expandPolygon = (
  polygon: Array<{ x: number; y: number }>,
  expandBy: number,
  scaleFactor: number = 1.0,
): Array<{ x: number; y: number }> => {
  if (polygon.length < 3) return polygon;

  // Calculate centroid
  const centroidX = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
  const centroidY = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;

  // Move each point away from centroid
  return polygon.map((p) => {
    const dx = p.x - centroidX;
    const dy = p.y - centroidY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return p;

    const scale = ((dist + expandBy) / dist) * scaleFactor;
    return {
      x: centroidX + dx * scale,
      y: centroidY + dy * scale,
    };
  });
};

// Douglas-Peucker algorithm to simplify polygon by reducing points
const simplifyPolygon = (
  polygon: Array<{ x: number; y: number }>,
  tolerance: number = 2,
): Array<{ x: number; y: number }> => {
  if (polygon.length < 3) return polygon;

  // Find perpendicular distance from point to line
  const perpendicularDistance = (
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number },
  ): number => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lineLenSq = dx * dx + dy * dy;

    if (lineLenSq === 0) {
      return Math.sqrt(
        (point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2,
      );
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) /
          lineLenSq,
      ),
    );
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;

    return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
  };

  const simplifySection = (
    points: Array<{ x: number; y: number }>,
    start: number,
    end: number,
    tolerance: number,
    result: Set<number>,
  ) => {
    let maxDist = 0;
    let maxIndex = start;

    for (let i = start + 1; i < end; i++) {
      const dist = perpendicularDistance(points[i], points[start], points[end]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > tolerance) {
      result.add(maxIndex);
      simplifySection(points, start, maxIndex, tolerance, result);
      simplifySection(points, maxIndex, end, tolerance, result);
    }
  };

  // For closed polygon, we need to handle it specially
  const result = new Set<number>();
  result.add(0);
  result.add(polygon.length - 1);

  simplifySection(polygon, 0, polygon.length - 1, tolerance, result);

  // Return simplified polygon maintaining order
  return polygon.filter((_, i) => result.has(i));
};

// Chaikin's corner cutting algorithm for smoothing polygons
const smoothPolygonChaikin = (
  polygon: Array<{ x: number; y: number }>,
  iterations: number = 2,
): Array<{ x: number; y: number }> => {
  if (polygon.length < 3) return polygon;

  let points = polygon;

  for (let iter = 0; iter < iterations; iter++) {
    const newPoints: Array<{ x: number; y: number }> = [];
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const p0 = points[i];
      const p1 = points[(i + 1) % n];

      // Q = 3/4 * P0 + 1/4 * P1
      newPoints.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      });

      // R = 1/4 * P0 + 3/4 * P1
      newPoints.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      });
    }

    points = newPoints;
  }

  return points;
};

// Simplify then smooth a polygon
const smoothPolygon = (
  polygon: Array<{ x: number; y: number }>,
  simplifyTolerance: number = 3,
  chaikinIterations: number = 3,
): Array<{ x: number; y: number }> => {
  const simplified = simplifyPolygon(polygon, simplifyTolerance);
  return smoothPolygonChaikin(simplified, chaikinIterations);
};

// Convert polygon to SVG path string
const polygonToPath = (polygon: Array<{ x: number; y: number }>): string => {
  if (polygon.length < 3) return "";

  let path = `M ${polygon[0].x} ${polygon[0].y} `;
  for (let i = 1; i < polygon.length; i++) {
    path += `L ${polygon[i].x} ${polygon[i].y} `;
  }
  path += "Z";
  return path;
};

// Helper function to find intersection point between a line and polygon perimeter
const findPerimeterIntersection = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  polygon: Array<{ x: number; y: number }>,
): { x: number; y: number } => {
  let closestDist = Infinity;
  let intersectionX = endX;
  let intersectionY = endY;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const x1 = startX,
      y1 = startY;
    const x2 = endX,
      y2 = endY;
    const x3 = p1.x,
      y3 = p1.y;
    const x4 = p2.x,
      y4 = p2.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) continue;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      const ix = x1 + t * (x2 - x1);
      const iy = y1 + t * (y2 - y1);
      const dist = Math.sqrt((ix - startX) ** 2 + (iy - startY) ** 2);
      if (dist < closestDist) {
        closestDist = dist;
        intersectionX = ix;
        intersectionY = iy;
      }
    }
  }

  return { x: intersectionX, y: intersectionY };
};

const FOOT_HOLD_COLOR = "#E91E9C";

export default function RouteOverlay({
  handHolds,
  footHolds = [],
  detectedHolds,
  width,
  height,
  pointerEvents = "none",
  onHandHoldPress,
  onFootHoldPress,
  resizingHoldIndex = null,
  showLabels = true,
  selectedHoldId = null,
  zoomScale = 1,
}: RouteOverlayProps) {
  // Memoize all expensive polygon calculations — only recompute when inputs change
  const {
    chaikinIterations,
    simplifyTolerance,
    detectedHoldsMap,
    footHoldDetectedIds,
    expandedPolygonsMap,
    smoothedPolygonsMap,
    allHolds,
  } = useMemo(() => {
    // Adjust smoothing based on zoom - more iterations for higher zoom
    const chaikinIterations = Math.min(5, 3 + Math.floor(zoomScale / 2));
    const simplifyTolerance = Math.max(1, 3 / zoomScale);

    // Create a map for quick lookup of detected holds by ID
    const detectedHoldsMap = new Map(detectedHolds.map((dh) => [dh.id, dh]));

    // Set of detected_hold_ids used by foot holds (for overlap rendering)
    const footHoldDetectedIds = new Set(
      footHolds.map((fh) => fh.detected_hold_id),
    );

    // Pre-calculate expanded and smoothed polygons for all holds (used for overlay holes, borders, and arrows)
    const expandedPolygonsMap = new Map<
      string,
      Array<{ x: number; y: number }>
    >();
    const smoothedPolygonsMap = new Map<
      string,
      Array<{ x: number; y: number }>
    >();

    // Process both hand holds and foot holds for polygon calculations
    const allDetectedHoldIds = new Set([
      ...handHolds.map((h) => h.detected_hold_id),
      ...footHolds.map((fh) => fh.detected_hold_id),
    ]);
    allDetectedHoldIds.forEach((detectedHoldId) => {
      const detectedHold = detectedHoldsMap.get(detectedHoldId);
      if (detectedHold) {
        const pixels = polygonToPixels(detectedHold.polygon, width, height);
        const expanded = expandPolygon(pixels, 3, 1.05);
        expandedPolygonsMap.set(detectedHoldId, expanded);
        const smoothed = smoothPolygon(
          expanded,
          simplifyTolerance,
          chaikinIterations,
        );
        smoothedPolygonsMap.set(detectedHoldId, smoothed);
      }
    });

    // Combined list for mask holes (deduplicated by detected_hold_id)
    const allHolds: Array<{ hold: Hold; key: string }> = [];
    const seenIds = new Set<string>();
    handHolds.forEach((hold, i) => {
      seenIds.add(hold.detected_hold_id);
      allHolds.push({ hold, key: `hand-${i}` });
    });
    footHolds.forEach((hold, i) => {
      if (!seenIds.has(hold.detected_hold_id)) {
        allHolds.push({ hold, key: `foot-${i}` });
      }
    });

    return {
      chaikinIterations,
      simplifyTolerance,
      detectedHoldsMap,
      footHoldDetectedIds,
      expandedPolygonsMap,
      smoothedPolygonsMap,
      allHolds,
    };
  }, [detectedHolds, handHolds, footHolds, width, height, zoomScale]);

  // Helper: sort holds by polygon area (largest first) for correct tap/render order
  const sortByAreaDesc = <T extends Hold>(
    holds: Array<{ hold: T; index: number }>,
  ) =>
    holds.sort((a, b) => {
      const aPixels = expandedPolygonsMap.get(a.hold.detected_hold_id);
      const bPixels = expandedPolygonsMap.get(b.hold.detected_hold_id);
      const aArea = aPixels ? calculatePolygonArea(aPixels) : 0;
      const bArea = bPixels ? calculatePolygonArea(bPixels) : 0;
      return bArea - aArea;
    });

  const svgElement = (
    <Svg
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      width={width}
      height={height}
      pointerEvents={pointerEvents}
    >
      <Defs>
        <Marker
          id="arrowhead"
          markerWidth="4"
          markerHeight="4"
          refX="3"
          refY="1.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <Polygon points="0 0, 4 1.5, 0 3" fill="#00AAFF" />
        </Marker>
      </Defs>

      {/* Dark overlay with holes for holds using mask */}
      {/* Mask: white = show overlay, black = transparent hole */}
      <Defs>
        <Mask id="holdsMask">
          <Rect x="0" y="0" width={width} height={height} fill="white" />
          {allHolds.map(({ hold, key }) => {
            const smoothedPixels = smoothedPolygonsMap.get(
              hold.detected_hold_id,
            );
            if (!smoothedPixels || smoothedPixels.length === 0) return null;
            return (
              <Path
                key={`mask-${key}`}
                d={polygonToPath(smoothedPixels)}
                fill="black"
              />
            );
          })}
        </Mask>
      </Defs>
      <Rect
        x="0"
        y="0"
        width={width}
        height={height}
        fill="rgba(0, 0, 0, 0.6)"
        mask="url(#holdsMask)"
      />

      {/* Draw connecting lines between hand holds (sequence arrows) */}
      {showLabels &&
        handHolds.map((hold, index) => {
          if (index === handHolds.length - 1) return null;
          const nextHold = handHolds[index + 1];

          const detectedHold = detectedHoldsMap.get(hold.detected_hold_id);
          const nextDetectedHold = detectedHoldsMap.get(
            nextHold.detected_hold_id,
          );

          if (!detectedHold || !nextDetectedHold) return null;

          const x1Center = (detectedHold.center.x / 100) * width;
          const y1Center = (detectedHold.center.y / 100) * height;
          const x2Center = (nextDetectedHold.center.x / 100) * width;
          const y2Center = (nextDetectedHold.center.y / 100) * height;

          // Get smoothed polygons for accurate perimeter intersection
          const polygon1 = smoothedPolygonsMap.get(hold.detected_hold_id);
          const polygon2 = smoothedPolygonsMap.get(nextHold.detected_hold_id);

          if (!polygon1 || !polygon2) return null;

          // Find start and end points on hold perimeters
          const startPoint = findPerimeterIntersection(
            x1Center,
            y1Center,
            x2Center,
            y2Center,
            polygon1,
          );
          const endPoint = findPerimeterIntersection(
            x1Center,
            y1Center,
            x2Center,
            y2Center,
            polygon2,
          );

          // Draw line from perimeter to perimeter
          return (
            <Line
              key={`sequence-${index}`}
              x1={startPoint.x}
              y1={startPoint.y}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke="#00AAFF"
              strokeWidth="2"
              strokeDasharray="5,5"
              markerEnd="url(#arrowhead)"
            />
          );
        })}

      {/* Draw lines from labels to holds (hand holds + foot holds with notes) */}
      {showLabels &&
        [
          ...handHolds.map((hold, index) => ({
            hold,
            key: `arrow-hand-${index}`,
          })),
          ...footHolds
            .filter((h) => h.note)
            .map((hold, index) => ({ hold, key: `arrow-foot-${index}` })),
        ].map(({ hold, key }) => {
          const detectedHold = detectedHoldsMap.get(hold.detected_hold_id);
          if (!detectedHold) return null;

          const holdXCenter = (detectedHold.center.x / 100) * width;
          const holdYCenter = (detectedHold.center.y / 100) * height;
          const labelX = (hold.labelX / 100) * width;
          const labelY = (hold.labelY / 100) * height;

          const holdPolygon = smoothedPolygonsMap.get(hold.detected_hold_id);
          if (!holdPolygon) return null;

          const endPoint = findPerimeterIntersection(
            labelX,
            labelY,
            holdXCenter,
            holdYCenter,
            holdPolygon,
          );

          return (
            <Line
              key={key}
              x1={labelX}
              y1={labelY}
              x2={endPoint.x}
              y2={endPoint.y}
              stroke="#FFFFFF"
              strokeWidth="1"
            />
          );
        })}

      {/* Draw hold borders and tappable areas — sorted by area (largest first) */}
      {sortByAreaDesc(handHolds.map((hold, index) => ({ hold, index }))).map(
        ({ hold, index }) => {
          const smoothedPixels = smoothedPolygonsMap.get(hold.detected_hold_id);
          if (!smoothedPixels) return null;

          const smoothPath = polygonToPath(smoothedPixels);
          const isSelected = hold.detected_hold_id === selectedHoldId;
          const isAlsoFoot = footHoldDetectedIds.has(hold.detected_hold_id);
          const borderColor = isSelected
            ? "#00AAFF"
            : isAlsoFoot
              ? FOOT_HOLD_COLOR
              : "#FFFFFF";

          return (
            <G key={`hand-polygon-${index}`}>
              {onHandHoldPress && (
                <Path
                  d={smoothPath}
                  fill="rgba(255, 255, 255, 0.01)"
                  stroke="transparent"
                  onPressIn={() => onHandHoldPress(index)}
                />
              )}
              <Path
                d={smoothPath}
                fill={
                  isSelected
                    ? "rgba(0, 170, 255, 0.3)"
                    : isAlsoFoot
                      ? "rgba(233, 30, 156, 0.12)"
                      : "none"
                }
                stroke={borderColor}
                strokeWidth={isSelected ? 3 : 0.5}
                pointerEvents="none"
              />
            </G>
          );
        },
      )}

      {/* Foot-only holds (not already rendered as hand holds) */}
      {sortByAreaDesc(footHolds.map((hold, index) => ({ hold, index }))).map(
        ({ hold, index }) => {
          if (
            handHolds.some((h) => h.detected_hold_id === hold.detected_hold_id)
          )
            return null;
          const smoothedPixels = smoothedPolygonsMap.get(hold.detected_hold_id);
          if (!smoothedPixels) return null;

          const smoothPath = polygonToPath(smoothedPixels);
          const isSelected = hold.detected_hold_id === selectedHoldId;

          return (
            <G key={`foot-polygon-${index}`}>
              {onFootHoldPress && (
                <Path
                  d={smoothPath}
                  fill="rgba(255, 255, 255, 0.01)"
                  stroke="transparent"
                  onPressIn={() => onFootHoldPress(index)}
                />
              )}
              <Path
                d={smoothPath}
                fill={
                  isSelected
                    ? "rgba(233, 30, 156, 0.3)"
                    : "rgba(233, 30, 156, 0.12)"
                }
                stroke={FOOT_HOLD_COLOR}
                strokeWidth={isSelected ? 3 : 0.5}
                pointerEvents="none"
              />
            </G>
          );
        },
      )}
    </Svg>
  );

  // Render labels as React Native components
  const labelsElement = showLabels ? (
    <>
      {handHolds.map((hold, index) => {
        const labelX = (hold.labelX / 100) * width;
        const labelY = (hold.labelY / 100) * height;
        const labelText = getHoldLabel(index, handHolds.length, hold.note);

        return (
          <View
            key={`label-${index}`}
            style={[
              styles.labelWrapper,
              {
                left: labelX,
                top: labelY,
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>{labelText}</Text>
            </View>
          </View>
        );
      })}
      {/* Foot hold labels — only shown when note is set */}
      {footHolds.map((hold, index) => {
        if (!hold.note) return null;
        const labelX = (hold.labelX / 100) * width;
        const labelY = (hold.labelY / 100) * height;

        return (
          <View
            key={`foot-label-${index}`}
            style={[
              styles.labelWrapper,
              {
                left: labelX,
                top: labelY,
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.labelContainer}>
              <Text style={styles.labelText}>{hold.note}</Text>
            </View>
          </View>
        );
      })}
    </>
  ) : null;

  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, width, height }}
      pointerEvents="box-none"
    >
      {svgElement}
      {labelsElement}
    </View>
  );
}

const styles = StyleSheet.create({
  labelWrapper: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    // Use negative margin to shift the center point
    marginLeft: -50,
    marginTop: -50,
    width: 100,
    height: 100,
  },
  labelContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 1,
    paddingVertical: 1,
    borderRadius: 3,
  },
  labelText: {
    fontSize: 10,
    lineHeight: 10,
    fontWeight: "600",
    color: "#333333",
    includeFontPadding: false,
  },
});
