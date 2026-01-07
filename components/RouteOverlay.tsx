import Svg, { Circle, Line, Defs, Marker, Polygon, G, Rect, Text as SvgText } from 'react-native-svg';
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
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="2"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <Polygon points="0 0, 6 2, 0 4" fill="#0066cc" />
        </Marker>
      </Defs>

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

        // Draw line from center to center (no offset needed with polygons)
        return (
          <Line
            key={`sequence-${index}`}
            x1={x1Center}
            y1={y1Center}
            x2={x2Center}
            y2={y2Center}
            stroke="#0066cc"
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
        const labelX = (hold.labelX / 100) * width;
        const labelY = (hold.labelY / 100) * height;

        // Calculate label background dimensions
        const labelText = hold.note ? `${hold.order}. ${hold.note}` : `${hold.order}`;
        const lines = labelText.split('\n');
        const maxLineLength = Math.max(...lines.map(line => line.length));
        const textWidth = maxLineLength * 6.5; // Approximate width per character
        const totalTextHeight = lines.length * 13; // Height per line
        const padding = 1; // Minimal padding

        // Label rectangle bounds (matching actual rendered rectangle)
        const rectLeft = labelX;
        const rectRight = labelX + textWidth + padding * 2;
        const rectTop = labelY - totalTextHeight - padding;
        const rectBottom = labelY + padding;

        // Label center for arrow calculation
        const labelCenterX = (rectLeft + rectRight) / 2;
        const labelCenterY = (rectTop + rectBottom) / 2;

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

        // Arrow points to hold center (polygon shape will be visible around it)
        return (
          <Line
            key={`arrow-${index}`}
            x1={startX}
            y1={startY}
            x2={holdXCenter}
            y2={holdYCenter}
            stroke="#FF0000"
            strokeWidth="2"
          />
        );
      })}

      {/* Draw hold polygons */}
      {holds.map((hold, index) => {
        const detectedHold = detectedHoldsMap.get(hold.detected_hold_id);
        if (!detectedHold) return null;

        // Convert polygon points from percentages to pixels
        const points = detectedHold.polygon
          .map(p => `${(p.x / 100) * width},${(p.y / 100) * height}`)
          .join(' ');

        return (
          <Polygon
            key={`polygon-${index}`}
            points={points}
            fill="rgba(255, 0, 0, 0.2)"
            stroke="#FF0000"
            strokeWidth="1"
            onPress={onHoldPress ? () => onHoldPress(index) : undefined}
          />
        );
      })}

      {/* Draw labels with background */}
      {holds.map((hold, index) => {
        const labelX = (hold.labelX / 100) * width;
        const labelY = (hold.labelY / 100) * height;
        const labelText = hold.note ? `${hold.order}. ${hold.note}` : `${hold.order}`;
        const lines = labelText.split('\n');
        const maxLineLength = Math.max(...lines.map(line => line.length));
        const textWidth = maxLineLength * 6.5;
        const lineHeight = 13;
        const totalTextHeight = lines.length * lineHeight;
        const padding = 1; // Minimal padding

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
                fontSize={14}
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
