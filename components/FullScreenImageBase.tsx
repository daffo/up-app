import { useState, useEffect, useRef, ReactNode } from 'react';
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
import ImageZoom from 'react-native-image-pan-zoom';
import { Hold, DetectedHold } from '../types/database.types';
import RouteOverlay from './RouteOverlay';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ZoomState {
  scale: number;
  positionX: number;
  positionY: number;
}

export interface FullScreenImageBaseProps {
  visible: boolean;
  photoUrl: string;
  holds: Hold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  showLabels?: boolean;
  closeButtonText?: string;
  // Optional callbacks for customization
  onImageTap?: (event: any) => void;
  onHoldPress?: (index: number) => void;
  // For rendering additional controls/modals
  children?: ReactNode;
  // For PanResponder integration
  panHandlers?: any;
  // For edit mode visual feedback
  resizingHoldIndex?: number | null;
  // Enable pointer events on overlay
  overlayPointerEvents?: 'none' | 'auto' | 'box-none';
  // Expose refs for advanced usage
  onZoomChange?: (zoomState: ZoomState) => void;
  onDimensionsReady?: (dimensions: ImageDimensions, offset: { x: number; y: number }) => void;
  // Optional header configuration
  headerTitle?: string;
  headerRight?: ReactNode;
  // Optional helper banner (shown below header)
  helperBanner?: ReactNode;
}

export default function FullScreenImageBase({
  visible,
  photoUrl,
  holds,
  detectedHolds,
  onClose,
  showLabels = true,
  closeButtonText = '✕',
  onImageTap,
  onHoldPress,
  children,
  panHandlers,
  resizingHoldIndex = null,
  overlayPointerEvents = 'none',
  onZoomChange,
  onDimensionsReady,
  headerTitle,
  headerRight,
  helperBanner,
}: FullScreenImageBaseProps) {
  const windowDimensions = useWindowDimensions();
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  // Zoom state tracking
  const zoomStateRef = useRef<ZoomState>({ scale: 1, positionX: 0, positionY: 0 });

  useEffect(() => {
    if (visible) {
      Image.getSize(photoUrl, (width, height) => {
        setImageNaturalSize({ width, height });
      });
    }
  }, [visible, photoUrl]);

  // Calculate actual displayed image dimensions based on contain mode
  const getDisplayedImageDimensions = (): ImageDimensions => {
    if (!imageNaturalSize.width || !imageNaturalSize.height) {
      return { width: 0, height: 0 };
    }

    const imageAspect = imageNaturalSize.width / imageNaturalSize.height;
    const windowAspect = windowDimensions.width / windowDimensions.height;

    let displayWidth, displayHeight;

    if (imageAspect > windowAspect) {
      displayWidth = windowDimensions.width;
      displayHeight = windowDimensions.width / imageAspect;
    } else {
      displayHeight = windowDimensions.height;
      displayWidth = windowDimensions.height * imageAspect;
    }

    return { width: displayWidth, height: displayHeight };
  };

  const displayedDimensions = getDisplayedImageDimensions();

  // Calculate centering offsets for SVG overlay
  const offsetX = (windowDimensions.width - displayedDimensions.width) / 2;
  const offsetY = (windowDimensions.height - displayedDimensions.height) / 2;

  // Notify parent of dimensions when ready
  useEffect(() => {
    if (displayedDimensions.width > 0 && onDimensionsReady) {
      onDimensionsReady(displayedDimensions, { x: offsetX, y: offsetY });
    }
  }, [displayedDimensions.width, displayedDimensions.height]);

  const handleZoomChange = (position: any) => {
    zoomStateRef.current = {
      scale: position.scale,
      positionX: position.positionX,
      positionY: position.positionY,
    };
    if (onZoomChange) {
      onZoomChange(zoomStateRef.current);
    }
  };

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
          onClick={onImageTap}
          onMove={handleZoomChange}
        >
          <View
            style={{ width: windowDimensions.width, height: windowDimensions.height }}
            {...(panHandlers || {})}
          >
            <Image
              source={{ uri: photoUrl }}
              style={styles.image}
              resizeMode="contain"
            />

            {displayedDimensions.width > 0 && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { left: offsetX, top: offsetY, width: displayedDimensions.width, height: displayedDimensions.height }
                ]}
                pointerEvents={overlayPointerEvents}
              >
                <RouteOverlay
                  holds={holds}
                  detectedHolds={detectedHolds}
                  width={displayedDimensions.width}
                  height={displayedDimensions.height}
                  pointerEvents={overlayPointerEvents}
                  resizingHoldIndex={resizingHoldIndex}
                  showLabels={showLabels}
                  onHoldPress={onHoldPress}
                />
              </View>
            )}
          </View>
        </ImageZoom>

        {/* Header or Close button */}
        {headerTitle ? (
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            {headerRight || (
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>{closeButtonText}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>{closeButtonText}</Text>
          </TouchableOpacity>
        )}

        {/* Helper banner */}
        {helperBanner}

        {/* Additional content (modals, controls, etc.) */}
        {children}
      </View>
    </Modal>
  );
}

// Export shared styles for child components to use
export const baseStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonDanger: {
    backgroundColor: '#dc3545',
  },
  modalButtonCancel: {
    backgroundColor: '#6c757d',
  },
  helperBanner: {
    position: 'absolute',
    top: 110,
    left: 0,
    right: 0,
    backgroundColor: '#0066cc',
    padding: 12,
  },
  helperText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  noteInput: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
});

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
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
