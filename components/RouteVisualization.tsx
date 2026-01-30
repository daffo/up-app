import { useState } from 'react';
import { View, Image as RNImage, StyleSheet, LayoutChangeEvent, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Hold, DetectedHold } from '../types/database.types';
import FullScreenRouteViewer from './FullScreenRouteViewer';
import FullScreenHoldEditor from './FullScreenHoldEditor';
import RouteOverlay from './RouteOverlay';

interface RouteVisualizationProps {
  photoUrl: string;
  holds: Hold[];
  detectedHolds: DetectedHold[];
  showLabels?: boolean;
  // Admin mode props - when true, fullscreen allows hold deletion
  adminMode?: boolean;
  photoId?: string;
  onDeleteDetectedHold?: (holdId: string) => void;
  onUpdateDetectedHold?: (holdId: string, updates: Partial<DetectedHold>) => void;
  onAddDetectedHold?: (hold: DetectedHold) => void;
}

export default function RouteVisualization({
  photoUrl,
  holds,
  detectedHolds,
  showLabels = true,
  adminMode = false,
  photoId,
  onDeleteDetectedHold,
  onUpdateDetectedHold,
  onAddDetectedHold,
}: RouteVisualizationProps) {
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [fullScreenVisible, setFullScreenVisible] = useState(false);

  const handleImageLoad = () => {
    RNImage.getSize(photoUrl, (width, height) => {
      setImageNaturalSize({ width, height });
    });
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerDimensions({ width, height });
  };

  // Calculate actual displayed image dimensions based on contain mode
  const getDisplayedImageDimensions = () => {
    if (!imageNaturalSize.width || !imageNaturalSize.height || !containerDimensions.width) {
      return { width: 0, height: 0 };
    }

    const imageAspect = imageNaturalSize.width / imageNaturalSize.height;
    const containerAspect = containerDimensions.width / containerDimensions.height;

    let displayWidth, displayHeight;

    if (imageAspect > containerAspect) {
      // Image is wider - constrained by width
      displayWidth = containerDimensions.width;
      displayHeight = containerDimensions.width / imageAspect;
    } else {
      // Image is taller - constrained by height
      displayHeight = containerDimensions.height;
      displayWidth = containerDimensions.height * imageAspect;
    }

    return { width: displayWidth, height: displayHeight };
  };

  const displayedDimensions = getDisplayedImageDimensions();

  // Calculate centering offsets for overlay
  const offsetX = (containerDimensions.width - displayedDimensions.width) / 2;
  const offsetY = (containerDimensions.height - displayedDimensions.height) / 2;

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          onPress={() => setFullScreenVisible(true)}
          activeOpacity={0.9}
          style={StyleSheet.absoluteFill}
        >
          <Image
            source={{ uri: photoUrl }}
            style={styles.image}
            contentFit="contain"
            onLoad={handleImageLoad}
            onLayout={handleLayout}
          />

          {displayedDimensions.width > 0 && (
            <View
              style={{
                position: 'absolute',
                left: offsetX,
                top: offsetY,
                width: displayedDimensions.width,
                height: displayedDimensions.height,
              }}
              pointerEvents="none"
            >
              <RouteOverlay
                holds={holds}
                detectedHolds={detectedHolds}
                width={displayedDimensions.width}
                height={displayedDimensions.height}
                pointerEvents="none"
                showLabels={showLabels}
              />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {adminMode && photoId ? (
        <FullScreenHoldEditor
          visible={fullScreenVisible}
          photoUrl={photoUrl}
          holds={holds}
          detectedHolds={detectedHolds}
          onClose={() => setFullScreenVisible(false)}
          photoId={photoId}
          onDeleteDetectedHold={onDeleteDetectedHold}
          onUpdateDetectedHold={onUpdateDetectedHold}
          onAddDetectedHold={onAddDetectedHold}
        />
      ) : (
        <FullScreenRouteViewer
          visible={fullScreenVisible}
          photoUrl={photoUrl}
          holds={holds}
          detectedHolds={detectedHolds}
          onClose={() => setFullScreenVisible(false)}
          showLabels={showLabels}
        />
      )}
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
