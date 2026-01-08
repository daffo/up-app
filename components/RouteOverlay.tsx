import Svg, { Circle, Line, Defs, Marker, Polygon, G, Rect, Text as SvgText, Path } from 'react-native-svg';
import { Hold, DetectedHold } from '../types/database.types';

interface RouteOverlayProps {
  holds: Hold[];
  detectedHolds: DetectedHold[]; // All detected holds for this photo
  width: number;
  height: number;
  pointerEvents?: 'none' | 'box-none' | 'auto';
  onHoldPress?: (index: number) => void;
  resizingHoldIndex?: number | null;
}

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
  const textWidth = maxLineLength * 4.5;
  const lineHeight = 8;
  const totalTextHeight = lines.length * lineHeight;
  const padding = 2;

  const rectLeft = labelX;
  const rectRight = labelX + textWidth + padding * 2;
  const rectTop = labelY - totalTextHeight - padding;
  const rectBottom = labelY + padding;
  const labelCenterX = (rectLeft + rectRight) / 2;
  const labelCenterY = (rectTop + rectBottom) / 2;

  return {
    labelX,
    labelY,
    labelText,
    lines,
    textWidth,
    lineHeight,
    totalTextHeight,
    padding,
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

// Helper function to expand polygon outward by a given number of pixels
const expandPolygon = (
  polygon: Array<{ x: number; y: number }>,
  expandBy: number
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

    const scale = (dist + expandBy) / dist;
    return {
      x: centroidX + dx * scale,
      y: centroidY + dy * scale
    };
  });
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
}: RouteOverlayProps) {
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
      const expanded = expandPolygon(pixels, 3);
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

          // Add each hold polygon as a hole (reverse winding)
          holds.forEach(hold => {
            const expandedPixels = expandedPolygonsMap.get(hold.detected_hold_id);
            if (!expandedPixels || expandedPixels.length === 0) return;

            // Add polygon in reverse order to create a hole
            pathData += `M ${expandedPixels[expandedPixels.length - 1].x} ${expandedPixels[expandedPixels.length - 1].y} `;
            for (let i = expandedPixels.length - 2; i >= 0; i--) {
              pathData += `L ${expandedPixels[i].x} ${expandedPixels[i].y} `;
            }
            pathData += 'Z ';
          });

          return pathData;
        })()}
        fill="rgba(0, 0, 0, 0.6)"
        fillRule="evenodd"
      />

      {/* Draw connecting lines between holds (sequence arrows) */}
      {holds.map((hold, index) => {
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
      {holds.map((hold, index) => {
        const detectedHold = detectedHoldsMap.get(hold.detected_hold_id);
        if (!detectedHold) return null;

        const holdXCenter = (detectedHold.center.x / 100) * width;
        const holdYCenter = (detectedHold.center.y / 100) * height;

        // Calculate label dimensions
        const labelDims = calculateLabelDimensions(hold, width, height);
        const { labelCenterX, labelCenterY, rectLeft, rectRight, rectTop, rectBottom } = labelDims;

        // Calculate angle from label center to hold center
        const angle = Math.atan2(holdYCenter - labelCenterY, holdXCenter - labelCenterX);

        // Find intersection point with label rectangle edge
        let startX = labelCenterX;
        let startY = labelCenterY;

        // Determine which edge the line exits from based on angle
        const dx = holdXCenter - labelCenterX;
        const dy = holdYCenter - labelCenterY;

        if (Math.abs(dx) > Math.abs(dy)) {
          // Line exits from left or right edge
          if (dx > 0) {
            // Right edge
            startX = rectRight;
            startY = labelCenterY + (dy / dx) * (rectRight - labelCenterX);
          } else {
            // Left edge
            startX = rectLeft;
            startY = labelCenterY + (dy / dx) * (rectLeft - labelCenterX);
          }
        } else {
          // Line exits from top or bottom edge
          if (dy > 0) {
            // Bottom edge
            startY = rectBottom;
            startX = labelCenterX + (dx / dy) * (rectBottom - labelCenterY);
          } else {
            // Top edge
            startY = rectTop;
            startX = labelCenterX + (dx / dy) * (rectTop - labelCenterY);
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

      {/* Draw hold borders */}
      {holds.map((hold, index) => {
        const expandedPixels = expandedPolygonsMap.get(hold.detected_hold_id);
        if (!expandedPixels) return null;

        // Convert expanded polygon to points string
        const points = expandedPixels
          .map(p => `${p.x},${p.y}`)
          .join(' ');

        return (
          <Polygon
            key={`polygon-${index}`}
            points={points}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="0.5"
            onPress={onHoldPress ? () => onHoldPress(index) : undefined}
          />
        );
      })}

      {/* Draw labels with background */}
      {holds.map((hold, index) => {
        const labelDims = calculateLabelDimensions(hold, width, height);
        const { labelX, labelY, labelText, lines, textWidth, lineHeight, totalTextHeight, padding } = labelDims;

        return (
          <G key={`label-${index}`}>
            <Rect
              x={labelX}
              y={labelY - totalTextHeight - padding}
              width={textWidth + padding * 2}
              height={totalTextHeight + padding * 2}
              fill="rgba(255, 255, 255, 0.9)"
              stroke="#000000"
              strokeWidth={1}
              rx={3}
            />
            {lines.map((line, lineIndex) => (
              <SvgText
                key={`line-${lineIndex}`}
                x={labelX + padding}
                y={labelY - totalTextHeight + lineHeight * (lineIndex + 1)}
                fontSize={10}
                fontWeight="bold"
                fill="#000000"
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
