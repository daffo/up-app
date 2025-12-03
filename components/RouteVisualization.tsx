import { useState } from 'react';
import { View, Image, StyleSheet, LayoutChangeEvent, TouchableOpacity, Modal } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Rect, G, Defs, Marker, Polygon } from 'react-native-svg';
import { Hold } from '../types/database.types';
import FullScreenRouteViewer from './FullScreenRouteViewer';

interface RouteVisualizationProps {
  photoUrl: string;
  holds: Hold[];
}

export default function RouteVisualization({ photoUrl, holds }: RouteVisualizationProps) {
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [fullScreenVisible, setFullScreenVisible] = useState(false);

  const handleImageLoad = () => {
    Image.getSize(photoUrl, (width, height) => {
      setImageNaturalSize({ width, height });
    });
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setImageDimensions({ width, height });
  };

  // Calculate scale factors to map hold coordinates to displayed image size
  const scaleX = imageDimensions.width / imageNaturalSize.width || 1;
  const scaleY = imageDimensions.height / imageNaturalSize.height || 1;

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setFullScreenVisible(true)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: photoUrl }}
          style={styles.image}
          resizeMode="contain"
          onLoad={handleImageLoad}
          onLayout={handleLayout}
        />

        {imageDimensions.width > 0 && (
        <Svg
          style={StyleSheet.absoluteFill}
          width={imageDimensions.width}
          height={imageDimensions.height}
        >
          {/* Define arrowhead markers */}
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
              <Polygon
                points="0 0, 10 3, 0 6"
                fill="#FF0000"
              />
            </Marker>
          </Defs>

          {/* Draw connecting lines between holds */}
          {holds.slice(0, -1).map((hold, index) => {
            const nextHold = holds[index + 1];

            // Calculate line from perimeter to perimeter
            const scaledRadius1 = hold.radius * Math.min(scaleX, scaleY);
            const scaledRadius2 = nextHold.radius * Math.min(scaleX, scaleY);

            const dx = nextHold.holdX * scaleX - hold.holdX * scaleX;
            const dy = nextHold.holdY * scaleY - hold.holdY * scaleY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / length;
            const uy = dy / length;

            // Start at perimeter of first circle
            const startX = hold.holdX * scaleX + ux * scaledRadius1;
            const startY = hold.holdY * scaleY + uy * scaledRadius1;

            // End at perimeter of second circle
            const endX = nextHold.holdX * scaleX - ux * scaledRadius2;
            const endY = nextHold.holdY * scaleY - uy * scaledRadius2;

            return (
              <Line
                key={`connect-${hold.order}`}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke="#FF0000"
                strokeWidth={2}
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead)"
              />
            );
          })}

          {/* Draw arrows from labels to holds */}
          {holds.map((hold) => {
            // Calculate arrow endpoint at circle perimeter
            const scaledRadius = hold.radius * Math.min(scaleX, scaleY);
            const dx = hold.holdX * scaleX - hold.labelX * scaleX;
            const dy = hold.holdY * scaleY - hold.labelY * scaleY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / length;
            const uy = dy / length;
            const endX = hold.holdX * scaleX - ux * scaledRadius;
            const endY = hold.holdY * scaleY - uy * scaledRadius;

            return (
              <Line
                key={`arrow-${hold.order}`}
                x1={hold.labelX * scaleX}
                y1={hold.labelY * scaleY}
                x2={endX}
                y2={endY}
                stroke="#FF0000"
                strokeWidth={2}
              />
            );
          })}

          {/* Draw circles */}
          {holds.map((hold) => (
            <Circle
              key={`circle-${hold.order}`}
              cx={hold.holdX * scaleX}
              cy={hold.holdY * scaleY}
              r={hold.radius * Math.min(scaleX, scaleY)}
              stroke="#FF0000"
              strokeWidth={3}
              fill="rgba(255, 0, 0, 0.2)"
            />
          ))}

          {/* Draw labels with order number and optional note */}
          {holds.map((hold) => {
            const labelText = hold.note ? `${hold.order}. ${hold.note}` : `${hold.order}`;
            // Estimate text width (rough approximation)
            const textWidth = labelText.length * 8;
            const textHeight = 18;
            const padding = 4;

            return (
              <G key={`label-${hold.order}`}>
                {/* Background rectangle */}
                <Rect
                  x={hold.labelX * scaleX - padding}
                  y={hold.labelY * scaleY - textHeight + padding}
                  width={textWidth + padding * 2}
                  height={textHeight + padding}
                  fill="rgba(255, 255, 255, 0.9)"
                  stroke="#000000"
                  strokeWidth={1}
                  rx={3}
                />
                {/* Text */}
                <SvgText
                  x={hold.labelX * scaleX}
                  y={hold.labelY * scaleY}
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
        )}
      </TouchableOpacity>

      <FullScreenRouteViewer
        visible={fullScreenVisible}
        photoUrl={photoUrl}
        holds={holds}
        onClose={() => setFullScreenVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
