import Svg, { Circle, Line, Defs, Marker, Polygon, G, Rect, Text as SvgText, Path } from 'react-native-svg';
import { Hold, DetectedHold } from '../types/database.types';
import { calculatePolygonArea } from '../utils/polygon';

interface RouteOverlayProps {
  holds: Hold[];
  detectedHolds: DetectedHold[]; // All detected holds for this photo
  width: number;
  height: number;
  pointerEvents?: 'none' | 'box-none' | 'auto';
  onHoldPress?: (index: number) => void;
  resizingHoldIndex?: number | null;
  showLabels?: boolean; // Whether to show labels and arrows (default: true)
  selectedHoldId?: string | null; // ID of currently selected hold for highlighting
  zoomScale?: number; // Zoom level to adjust smoothing (default: 1)
}

// Constants for pill label styling
const PILL_FONT_SIZE = 10;
const PILL_CHAR_WIDTH = 5; // Average character width for 10px font
const PILL_PADDING_H = 2; // Horizontal padding
const PILL_PADDING_V = 2; // Vertical padding
const PILL_LINE_HEIGHT = 12;

// Helper function to calculate label dimensions
const calculateLabelDimensions = (
  hold: Hold,
  width: number,
  height: number
) => {
  const labelX = (hold.labelX / 100) * width;
  const labelY = (hold.labelY / 100) * height;
  const labelText = hold.note ? `${hold.order}. ${hold.note}` : `${hold.order}`;
  const lines = labelText.split('\n');
  const maxLineLength = Math.max(...lines.map(line => line.length));

  // Calculate pill dimensions based on content
  const textWidth = maxLineLength * PILL_CHAR_WIDTH;
  const pillWidth = textWidth + PILL_PADDING_H * 2;
  const pillHeight = lines.length * PILL_LINE_HEIGHT + PILL_PADDING_V * 2;

  // Pill is positioned with labelX,labelY as its center point
  const rectLeft = labelX - pillWidth / 2;
  const rectRight = labelX + pillWidth / 2;
  const rectTop = labelY - pillHeight / 2;
  const rectBottom = labelY + pillHeight / 2;
  const labelCenterX = labelX;
  const labelCenterY = labelY;

  return {
    labelX,
    labelY,
    labelText,
    lines,
    pillWidth,
    pillHeight,
    rectLeft,
    rectRight,
    rectTop,
    rectBottom,
    labelCenterX,
    labelCenterY,
  };
};

// Helper function to convert polygon percentage coordinates to pixels
const polygonToPixels = (
  polygon: Array<{ x: number; y: number }>,
  width: number,
  height: number
): Array<{ x: number; y: number }> => {
  return polygon.map(p => ({
    x: (p.x / 100) * width,
    y: (p.y / 100) * height
  }));
};

// Helper function to expand polygon outward by a given number of pixels and optional scale
const expandPolygon = (
  polygon: Array<{ x: number; y: number }>,
  expandBy: number,
  scaleFactor: number = 1.0
): Array<{ x: number; y: number }> => {
  if (polygon.length < 3) return polygon;

  // Calculate centroid
  const centroidX = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
  const centroidY = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;

  // Move each point away from centroid
  return polygon.map(p => {
    const dx = p.x - centroidX;
    const dy = p.y - centroidY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return p;

    const scale = ((dist + expandBy) / dist) * scaleFactor;
    return {
      x: centroidX + dx * scale,
      y: centroidY + dy * scale
    };
  });
};

// Douglas-Peucker algorithm to simplify polygon by reducing points
const simplifyPolygon = (
  polygon: Array<{ x: number; y: number }>,
  tolerance: number = 2
): Array<{ x: number; y: number }> => {
  if (polygon.length < 3) return polygon;

  // Find perpendicular distance from point to line
  const perpendicularDistance = (
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
  ): number => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lineLenSq = dx * dx + dy * dy;

    if (lineLenSq === 0) {
      return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    }

    const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLenSq));
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;

    return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
  };

  const simplifySection = (
    points: Array<{ x: number; y: number }>,
    start: number,
    end: number,
    tolerance: number,
    result: Set<number>
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
  iterations: number = 2
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
  chaikinIterations: number = 3
): Array<{ x: number; y: number }> => {
  const simplified = simplifyPolygon(polygon, simplifyTolerance);
  return smoothPolygonChaikin(simplified, chaikinIterations);
};

// Convert polygon to SVG path string
const polygonToPath = (polygon: Array<{ x: number; y: number }>): string => {
  if (polygon.length < 3) return '';

  let path = `M ${polygon[0].x} ${polygon[0].y} `;
  for (let i = 1; i < polygon.length; i++) {
    path += `L ${polygon[i].x} ${polygon[i].y} `;
  }
  path += 'Z';
  return path;
};


// Helper function to find intersection point between a line and polygon perimeter
const findPerimeterIntersection = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  polygon: Array<{ x: number; y: number }>
): { x: number; y: number } => {
  let closestDist = Infinity;
  let intersectionX = endX;
  let intersectionY = endY;

  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    const x1 = startX, y1 = startY;
    const x2 = endX, y2 = endY;
    const x3 = p1.x, y3 = p1.y;
    const x4 = p2.x, y4 = p2.y;

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

export default function RouteOverlay({
  holds,
  detectedHolds,
  width,
  height,
  pointerEvents = 'none',
  onHoldPress,
  resizingHoldIndex = null,
  showLabels = true,
  selectedHoldId = null,
  zoomScale = 1,
}: RouteOverlayProps) {
  // Adjust smoothing based on zoom - more iterations for higher zoom
  const chaikinIterations = Math.min(5, 3 + Math.floor(zoomScale / 2));
  const simplifyTolerance = Math.max(1, 3 / zoomScale);
  // Create a map for quick lookup of detected holds by ID
  const detectedHoldsMap = new Map(
    detectedHolds.map(dh => [dh.id, dh])
  );

  // Pre-calculate expanded polygons for all holds (used for overlay holes, borders, and arrows)
  const expandedPolygonsMap = new Map<string, Array<{ x: number; y: number }>>();
  holds.forEach(hold => {
    const detectedHold = detectedHoldsMap.get(hold.detected_hold_id);
    if (detectedHold) {
      const pixels = polygonToPixels(detectedHold.polygon, width, height);
      const expanded = expandPolygon(pixels, 3, 1.05);
      expandedPolygonsMap.set(hold.detected_hold_id, expanded);
    }
  });

  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
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

      {/* Dark overlay with holes for holds */}
      <Path
        d={(() => {
          // Start with outer rectangle
          let pathData = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z `;

          // Add each hold polygon as a smooth hole (reverse winding)
          holds.forEach(hold => {
            const expandedPixels = expandedPolygonsMap.get(hold.detected_hold_id);
            if (!expandedPixels || expandedPixels.length === 0) return;

            // Reverse the polygon for hole winding, then simplify and smooth it
            const reversed = [...expandedPixels].reverse();
            const smoothed = smoothPolygon(reversed, simplifyTolerance, chaikinIterations);
            pathData += polygonToPath(smoothed) + ' ';
          });

          return pathData;
        })()}
        fill="rgba(0, 0, 0, 0.6)"
        fillRule="evenodd"
      />

      {/* Draw connecting lines between holds (sequence arrows) */}
      {showLabels && holds.map((hold, index) => {
        if (index === holds.length - 1) return null;
        const nextHold = holds[index + 1];

        const detectedHold = detectedHoldsMap.get(hold.detected_hold_id);
        const nextDetectedHold = detectedHoldsMap.get(nextHold.detected_hold_id);

        if (!detectedHold || !nextDetectedHold) return null;

        const x1Center = (detectedHold.center.x / 100) * width;
        const y1Center = (detectedHold.center.y / 100) * height;
        const x2Center = (nextDetectedHold.center.x / 100) * width;
        const y2Center = (nextDetectedHold.center.y / 100) * height;

        // Get expanded polygons
        const polygon1 = expandedPolygonsMap.get(hold.detected_hold_id);
        const polygon2 = expandedPolygonsMap.get(nextHold.detected_hold_id);

        if (!polygon1 || !polygon2) return null;

        // Find start and end points on hold perimeters
        const startPoint = findPerimeterIntersection(x1Center, y1Center, x2Center, y2Center, polygon1);
        const endPoint = findPerimeterIntersection(x1Center, y1Center, x2Center, y2Center, polygon2);

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

      {/* Draw arrows from labels to holds */}
      {showLabels && holds.map((hold, index) => {
        const detectedHold = detectedHoldsMap.get(hold.detected_hold_id);
        if (!detectedHold) return null;

        const holdXCenter = (detectedHold.center.x / 100) * width;
        const holdYCenter = (detectedHold.center.y / 100) * height;

        // Calculate label dimensions
        const labelDims = calculateLabelDimensions(hold, width, height);
        const { labelCenterX, labelCenterY, rectLeft, rectRight, rectTop, rectBottom, pillWidth, pillHeight } = labelDims;

        // Pill radius for the rounded ends
        const pillRadius = pillHeight / 2;

        // Direction from label center to hold
        const dx = holdXCenter - labelCenterX;
        const dy = holdYCenter - labelCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return null;

        // Normalize direction
        const nx = dx / dist;
        const ny = dy / dist;

        // Find intersection with pill shape
        // The pill consists of: a rectangle in the middle + semicircles on left/right ends
        // Left semicircle center: (rectLeft + pillRadius, labelCenterY)
        // Right semicircle center: (rectRight - pillRadius, labelCenterY)

        let startX = labelCenterX;
        let startY = labelCenterY;

        // Check if line exits through the flat top/bottom or through the rounded ends
        const leftCircleCenterX = rectLeft + pillRadius;
        const rightCircleCenterX = rectRight - pillRadius;

        // Calculate where line would hit top/bottom edges
        if (ny !== 0) {
          const tTop = (rectTop - labelCenterY) / ny;
          const tBottom = (rectBottom - labelCenterY) / ny;
          const t = ny < 0 ? tTop : tBottom;
          if (t > 0) {
            const hitX = labelCenterX + nx * t;
            // Check if hitX is in the flat middle section
            if (hitX >= leftCircleCenterX && hitX <= rightCircleCenterX) {
              startX = hitX;
              startY = ny < 0 ? rectTop : rectBottom;
            }
          }
        }

        // If we didn't hit the flat section, calculate intersection with the semicircle
        if (startX === labelCenterX && startY === labelCenterY) {
          // Determine which semicircle (left or right)
          const circleCenterX = nx < 0 ? leftCircleCenterX : rightCircleCenterX;
          const circleCenterY = labelCenterY;

          // Ray-circle intersection from label center
          // Ray: P = labelCenter + t * n
          // Circle: |P - circleCenter|^2 = r^2
          const ocX = labelCenterX - circleCenterX;
          const ocY = labelCenterY - circleCenterY;

          const a = 1; // nx^2 + ny^2 = 1
          const b = 2 * (ocX * nx + ocY * ny);
          const c = ocX * ocX + ocY * ocY - pillRadius * pillRadius;

          const discriminant = b * b - 4 * a * c;
          if (discriminant >= 0) {
            const t = (-b + Math.sqrt(discriminant)) / (2 * a);
            if (t > 0) {
              startX = labelCenterX + nx * t;
              startY = labelCenterY + ny * t;
            }
          }
        }

        // Get expanded polygon
        const holdPolygon = expandedPolygonsMap.get(hold.detected_hold_id);
        if (!holdPolygon) return null;

        const endPoint = findPerimeterIntersection(startX, startY, holdXCenter, holdYCenter, holdPolygon);

        // Arrow points to hold perimeter
        return (
          <Line
            key={`arrow-${index}`}
            x1={startX}
            y1={startY}
            x2={endPoint.x}
            y2={endPoint.y}
            stroke="#FF0000"
            strokeWidth="1"
          />
        );
      })}

      {/* Draw hold borders and tappable areas */}
      {/* Sort by area (largest first) so smaller holds render on top and receive taps first */}
      {holds
        .map((hold, index) => ({ hold, index }))
        .sort((a, b) => {
          const aPixels = expandedPolygonsMap.get(a.hold.detected_hold_id);
          const bPixels = expandedPolygonsMap.get(b.hold.detected_hold_id);
          const aArea = aPixels ? calculatePolygonArea(aPixels) : 0;
          const bArea = bPixels ? calculatePolygonArea(bPixels) : 0;
          return bArea - aArea; // Largest first, smallest last (on top)
        })
        .map(({ hold, index }) => {
          const expandedPixels = expandedPolygonsMap.get(hold.detected_hold_id);
          if (!expandedPixels) return null;

          // Simplify and smooth the polygon, then convert to path
          const smoothed = smoothPolygon(expandedPixels, simplifyTolerance, chaikinIterations);
          const smoothPath = polygonToPath(smoothed);

          const isSelected = hold.detected_hold_id === selectedHoldId;

          return (
            <G key={`polygon-${index}`}>
              {/* Tappable area - use onPressIn for immediate response */}
              {onHoldPress && (
                <Path
                  d={smoothPath}
                  fill="rgba(255, 255, 255, 0.01)"
                  stroke="transparent"
                  onPressIn={() => onHoldPress(index)}
                />
              )}
              {/* Visible border - highlighted when selected */}
              <Path
                d={smoothPath}
                fill={isSelected ? "rgba(0, 170, 255, 0.3)" : "none"}
                stroke={isSelected ? "#00AAFF" : "#FFFFFF"}
                strokeWidth={isSelected ? 3 : 0.5}
                pointerEvents="none"
              />
            </G>
          );
        })}

      {/* Draw labels with pill background */}
      {showLabels && holds.map((hold, index) => {
        const labelDims = calculateLabelDimensions(hold, width, height);
        const { labelX, labelY, labelText, lines, pillWidth, pillHeight, rectLeft, rectTop } = labelDims;

        // Pill radius - fully rounded ends
        const pillRadius = pillHeight / 2;

        return (
          <G key={`label-${index}`}>
            <Rect
              x={rectLeft}
              y={rectTop}
              width={pillWidth}
              height={pillHeight}
              fill="rgba(255, 255, 255, 0.95)"
              stroke="#333333"
              strokeWidth={1}
              rx={pillRadius}
              ry={pillRadius}
            />
            {lines.map((line, lineIndex) => (
              <SvgText
                key={`line-${lineIndex}`}
                x={labelX}
                y={rectTop + PILL_PADDING_V + PILL_LINE_HEIGHT * (lineIndex + 0.75)}
                fontSize={PILL_FONT_SIZE}
                fontWeight="600"
                fill="#333333"
                textAnchor="middle"
              >
                {line}
              </SvgText>
            ))}
          </G>
        );
      })}
    </Svg>
  );
}
