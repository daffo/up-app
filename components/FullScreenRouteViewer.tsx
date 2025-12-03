import { useState, useEffect } from 'react';
import {
  View,
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import Svg, { Circle, Line, Text as SvgText, Rect, G, Defs, Marker, Polygon } from 'react-native-svg';
import ImageZoom from 'react-native-image-pan-zoom';
import { Hold } from '../types/database.types';

interface FullScreenRouteViewerProps {
  visible: boolean;
  photoUrl: string;
  holds: Hold[];
  onClose: () => void;
}

export default function FullScreenRouteViewer({
  visible,
  photoUrl,
  holds,
  onClose,
}: FullScreenRouteViewerProps) {
  const windowDimensions = useWindowDimensions();
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (visible) {
      Image.getSize(photoUrl, (width, height) => {
        setImageNaturalSize({ width, height });
      });
    }
  }, [visible, photoUrl]);

  // Calculate actual displayed image dimensions based on contain mode
  const getDisplayedImageDimensions = () => {
    if (!imageNaturalSize.width || !imageNaturalSize.height) {
      return { width: 0, height: 0 };
    }

    const imageAspect = imageNaturalSize.width / imageNaturalSize.height;
    const windowAspect = windowDimensions.width / windowDimensions.height;

    let displayWidth, displayHeight;

    if (imageAspect > windowAspect) {
      // Image is wider than window - constrained by width
      displayWidth = windowDimensions.width;
      displayHeight = windowDimensions.width / imageAspect;
    } else {
      // Image is taller than window - constrained by height
      displayHeight = windowDimensions.height;
      displayWidth = windowDimensions.height * imageAspect;
    }

    return { width: displayWidth, height: displayHeight };
  };

  const displayedDimensions = getDisplayedImageDimensions();

  // Calculate scale factors to map hold coordinates to displayed image size
  const scaleX = displayedDimensions.width / imageNaturalSize.width || 1;
  const scaleY = displayedDimensions.height / imageNaturalSize.height || 1;

  // Calculate centering offsets for SVG overlay
  const offsetX = (windowDimensions.width - displayedDimensions.width) / 2;
  const offsetY = (windowDimensions.height - displayedDimensions.height) / 2;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={styles.container}>
        <ImageZoom
          cropWidth={windowDimensions.width}
          cropHeight={windowDimensions.height}
          imageWidth={windowDimensions.width}
          imageHeight={windowDimensions.height}
          minScale={1}
          maxScale={4}
        >
          <View style={{ width: windowDimensions.width, height: windowDimensions.height }}>
            <Image
              source={{ uri: photoUrl }}
              style={styles.image}
              resizeMode="contain"
            />

            {displayedDimensions.width > 0 && (
              <Svg
                style={[
                  StyleSheet.absoluteFill,
                  { left: offsetX, top: offsetY }
                ]}
                width={displayedDimensions.width}
                height={displayedDimensions.height}
              >
                {/* Define arrowhead markers */}
                <Defs>
                  <Marker
                    id="arrowhead-fullscreen"
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
                      markerEnd="url(#arrowhead-fullscreen)"
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
          </View>
        </ImageZoom>

        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
