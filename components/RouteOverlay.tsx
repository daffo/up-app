import Svg, { Circle, Line, Defs, Marker, Polygon, G, Rect, Text as SvgText } from 'react-native-svg';
import { Hold } from '../types/database.types';

interface RouteOverlayProps {
  holds: Hold[];
  width: number;
  height: number;
  pointerEvents?: 'none' | 'box-none' | 'auto';
  onHoldPress?: (index: number) => void;
}

export default function RouteOverlay({
  holds,
  width,
  height,
  pointerEvents = 'none',
  onHoldPress,
}: RouteOverlayProps) {
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
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <Polygon points="0 0, 10 3, 0 6" fill="#0066cc" />
        </Marker>
      </Defs>

      {/* Draw connecting lines between holds (sequence arrows) */}
      {holds.map((hold, index) => {
        if (index === holds.length - 1) return null;
        const nextHold = holds[index + 1];

        const x1Center = (hold.holdX / 100) * width;
        const y1Center = (hold.holdY / 100) * height;
        const x2Center = (nextHold.holdX / 100) * width;
        const y2Center = (nextHold.holdY / 100) * height;
        const r1 = (hold.radius / 100) * width;
        const r2 = (nextHold.radius / 100) * width;

        // Calculate angle and offset points to circle perimeter
        const angle = Math.atan2(y2Center - y1Center, x2Center - x1Center);
        const x1 = x1Center + r1 * Math.cos(angle);
        const y1 = y1Center + r1 * Math.sin(angle);
        const x2 = x2Center - r2 * Math.cos(angle);
        const y2 = y2Center - r2 * Math.sin(angle);

        return (
          <Line
            key={`sequence-${index}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#0066cc"
            strokeWidth="2"
            strokeDasharray="5,5"
            markerEnd="url(#arrowhead)"
          />
        );
      })}

      {/* Draw arrows from labels to holds */}
      {holds.map((hold, index) => {
        const holdXCenter = (hold.holdX / 100) * width;
        const holdYCenter = (hold.holdY / 100) * height;
        const labelX = (hold.labelX / 100) * width;
        const labelY = (hold.labelY / 100) * height;
        const radius = (hold.radius / 100) * width;

        // Calculate label background dimensions
        const labelText = hold.note ? `${hold.order}. ${hold.note}` : `${hold.order}`;
        const textWidth = labelText.length * 8;
        const textHeight = 18;
        const padding = 4;

        // Label rectangle bounds
        const rectLeft = labelX - padding;
        const rectRight = labelX + textWidth + padding;
        const rectTop = labelY - textHeight + padding;
        const rectBottom = labelY + padding;

        // Calculate angle from label center to hold
        const angle = Math.atan2(holdYCenter - labelY, holdXCenter - labelX);

        // Find intersection point with label rectangle edge
        let startX = labelX;
        let startY = labelY;

        // Determine which edge the line exits from based on angle
        const dx = holdXCenter - labelX;
        const dy = holdYCenter - labelY;

        if (Math.abs(dx) > Math.abs(dy)) {
          // Line exits from left or right edge
          if (dx > 0) {
            // Right edge
            startX = rectRight;
            startY = labelY + (dy / dx) * (rectRight - labelX);
          } else {
            // Left edge
            startX = rectLeft;
            startY = labelY + (dy / dx) * (rectLeft - labelX);
          }
        } else {
          // Line exits from top or bottom edge
          if (dy > 0) {
            // Bottom edge
            startY = rectBottom;
            startX = labelX + (dx / dy) * (rectBottom - labelY);
          } else {
            // Top edge
            startY = rectTop;
            startX = labelX + (dx / dy) * (rectTop - labelY);
          }
        }

        // Calculate end point at circle perimeter
        const holdX = holdXCenter - radius * Math.cos(angle);
        const holdY = holdYCenter - radius * Math.sin(angle);

        return (
          <Line
            key={`arrow-${index}`}
            x1={startX}
            y1={startY}
            x2={holdX}
            y2={holdY}
            stroke="#FF0000"
            strokeWidth="2"
          />
        );
      })}

      {/* Draw hold circles */}
      {holds.map((hold, index) => {
        const x = (hold.holdX / 100) * width;
        const y = (hold.holdY / 100) * height;
        const r = (hold.radius / 100) * width;

        return (
          <Circle
            key={`circle-${index}`}
            cx={x}
            cy={y}
            r={r}
            fill="rgba(255, 0, 0, 0.2)"
            stroke="#FF0000"
            strokeWidth="2"
            onPress={onHoldPress ? () => onHoldPress(index) : undefined}
          />
        );
      })}

      {/* Draw labels with background */}
      {holds.map((hold, index) => {
        const labelX = (hold.labelX / 100) * width;
        const labelY = (hold.labelY / 100) * height;
        const labelText = hold.note ? `${hold.order}. ${hold.note}` : `${hold.order}`;
        const textWidth = labelText.length * 8;
        const textHeight = 18;
        const padding = 4;

        return (
          <G key={`label-${index}`}>
            <Rect
              x={labelX - padding}
              y={labelY - textHeight + padding}
              width={textWidth + padding * 2}
              height={textHeight + padding}
              fill="rgba(255, 255, 255, 0.9)"
              stroke="#000000"
              strokeWidth={1}
              rx={3}
            />
            <SvgText
              x={labelX}
              y={labelY}
              fontSize={14}
              fontWeight="bold"
              fill="#000000"
            >
              {labelText}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
