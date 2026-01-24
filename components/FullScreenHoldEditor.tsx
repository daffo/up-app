import React, { useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { Hold, DetectedHold } from '../types/database.types';
import { supabase } from '../lib/supabase';
import FullScreenImageBase, { baseStyles, ImageDimensions } from './FullScreenImageBase';
import RouteOverlay from './RouteOverlay';
import { findSmallestPolygonAtPoint } from '../utils/polygon';

interface FullScreenHoldEditorProps {
  visible: boolean;
  photoUrl: string;
  holds: Hold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  photoId: string;
  onDeleteDetectedHold?: (holdId: string) => void;
}

type FocusMode = 'none' | 'selecting' | 'focused';

interface FocusRegion {
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
}

export default function FullScreenHoldEditor({
  visible,
  photoUrl,
  holds,
  detectedHolds,
  onClose,
  photoId,
  onDeleteDetectedHold,
}: FullScreenHoldEditorProps) {
  const windowDimensions = useWindowDimensions();
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [routesUsingHold, setRoutesUsingHold] = useState<string[]>([]);

  // Focus mode state
  const [focusMode, setFocusMode] = useState<FocusMode>('none');
  const [focusRegion, setFocusRegion] = useState<FocusRegion | null>(null);

  // Image dimensions for coordinate conversion
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>({ width: 0, height: 0 });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  // Handle tap on image - select hold on tap, deselect if tapping elsewhere
  const handleImageTap = (event: any) => {
    if (imageDimensions.width === 0) return;

    const { locationX, locationY } = event;

    // Convert screen coordinates to image-relative coordinates
    const imageX = locationX - imageOffset.x;
    const imageY = locationY - imageOffset.y;

    // Check if tap is outside the image bounds
    if (imageX < 0 || imageX > imageDimensions.width ||
        imageY < 0 || imageY > imageDimensions.height) {
      setSelectedHoldId(null); // Deselect on tap outside
      return;
    }

    // Convert to percentages
    const xPercent = (imageX / imageDimensions.width) * 100;
    const yPercent = (imageY / imageDimensions.height) * 100;

    // Find smallest hold at tap point
    const tappedHold = findSmallestPolygonAtPoint(xPercent, yPercent, detectedHolds);
    if (tappedHold) {
      // Select hold (or toggle if already selected)
      setSelectedHoldId(tappedHold.id === selectedHoldId ? null : tappedHold.id);
    } else {
      // Deselect if tapping on empty area
      setSelectedHoldId(null);
    }
  };

  const handleEditSelected = () => {
    if (selectedHoldId) {
      setDeleteModalVisible(true);
    }
  };

  const handleDeleteHold = async () => {
    if (selectedHoldId === null) return;

    const selectedHold = detectedHolds.find(h => h.id === selectedHoldId);
    if (!selectedHold) return;
    setIsDeleting(true);

    // Check if this hold is used in any route
    const { data: routes } = await supabase
      .from('routes')
      .select('id, title, holds')
      .eq('photo_id', photoId);

    const usingRoutes: string[] = [];
    if (routes) {
      for (const route of routes) {
        const routeHolds = route.holds as Hold[];
        if (routeHolds.some(h => h.detected_hold_id === selectedHold.id)) {
          usingRoutes.push(route.title);
        }
      }
    }

    // If hold is used in routes, show error and abort
    if (usingRoutes.length > 0) {
      setIsDeleting(false);
      setRoutesUsingHold(usingRoutes);
      return;
    }

    // Delete the hold
    const { error } = await supabase
      .from('detected_holds')
      .delete()
      .eq('id', selectedHold.id);

    setIsDeleting(false);

    if (error) {
      Alert.alert('Error', 'Failed to delete hold: ' + error.message);
      return;
    }

    // Notify parent to update state
    if (onDeleteDetectedHold) {
      onDeleteDetectedHold(selectedHold.id);
    }

    closeModal();
  };

  const closeModal = () => {
    setDeleteModalVisible(false);
    setSelectedHoldId(null);
    setRoutesUsingHold([]);
  };

  // Handle dimensions from base component
  const handleDimensionsReady = (dimensions: ImageDimensions, offset: { x: number; y: number }) => {
    setImageDimensions(dimensions);
    setImageOffset(offset);
  };

  // Load natural image size for focused view
  React.useEffect(() => {
    if (visible && photoUrl) {
      Image.getSize(photoUrl, (width, height) => {
        setImageNaturalSize({ width, height });
      });
    }
  }, [visible, photoUrl]);

  // Convert screen coordinates to image percentage
  const screenToImagePercent = (screenX: number, screenY: number) => {
    const imageX = screenX - imageOffset.x;
    const imageY = screenY - imageOffset.y;
    return {
      x: (imageX / imageDimensions.width) * 100,
      y: (imageY / imageDimensions.height) * 100,
    };
  };

  // Handle tap in selecting mode - single tap to zoom
  const handleSelectingTap = (event: any) => {
    if (focusMode !== 'selecting') return;

    const { locationX, locationY } = event;
    const percent = screenToImagePercent(locationX, locationY);

    // Clamp to image bounds
    const centerX = Math.max(0, Math.min(100, percent.x));
    const centerY = Math.max(0, Math.min(100, percent.y));

    // Fixed zoom size (15% = ~6.6x zoom)
    const zoomSize = 15;
    const halfSize = zoomSize / 2;

    let minX = centerX - halfSize;
    let maxX = centerX + halfSize;
    let minY = centerY - halfSize;
    let maxY = centerY + halfSize;

    // Shift region to stay within bounds
    if (minX < 0) {
      maxX -= minX;
      minX = 0;
    }
    if (maxX > 100) {
      minX -= (maxX - 100);
      maxX = 100;
    }
    if (minY < 0) {
      maxY -= minY;
      minY = 0;
    }
    if (maxY > 100) {
      minY -= (maxY - 100);
      maxY = 100;
    }

    // Final clamp
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(100, maxX);
    maxY = Math.min(100, maxY);

    setFocusRegion({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
    setFocusMode('focused');
  };

  // Start focus selection mode
  const startFocusSelection = () => {
    setFocusMode('selecting');
  };

  // Exit focus mode
  const exitFocusMode = () => {
    setFocusMode('none');
    setFocusRegion(null);
  };

  // Cancel selection
  const cancelSelection = () => {
    setFocusMode('none');
  };

  // Get holds in current focus region (for focused mode)
  const getHoldsInRegion = () => {
    if (!focusRegion) return [];
    return detectedHolds.filter(hold => {
      const centerX = hold.polygon.reduce((sum, p) => sum + p.x, 0) / hold.polygon.length;
      const centerY = hold.polygon.reduce((sum, p) => sum + p.y, 0) / hold.polygon.length;
      return (
        centerX >= focusRegion.x &&
        centerX <= focusRegion.x + focusRegion.width &&
        centerY >= focusRegion.y &&
        centerY <= focusRegion.y + focusRegion.height
      );
    });
  };

  // Handle hold press in focused mode - need to map index correctly
  const handleFocusedHoldPress = (index: number) => {
    const holdsInRegion = getHoldsInRegion();
    const hold = holdsInRegion[index];
    if (hold) {
      // Toggle selection
      setSelectedHoldId(hold.id === selectedHoldId ? null : hold.id);
    }
  };

  // Calculate focused view dimensions and image positioning
  const getFocusedViewProps = () => {
    if (!focusRegion || !imageNaturalSize.width) return null;

    // The region in the natural image
    const naturalRegion = {
      x: (focusRegion.x / 100) * imageNaturalSize.width,
      y: (focusRegion.y / 100) * imageNaturalSize.height,
      width: (focusRegion.width / 100) * imageNaturalSize.width,
      height: (focusRegion.height / 100) * imageNaturalSize.height,
    };

    // Aspect ratio of the region
    const regionAspect = naturalRegion.width / naturalRegion.height;
    const screenAspect = windowDimensions.width / windowDimensions.height;

    // Calculate display size to fit region on screen
    let displayWidth, displayHeight;
    if (regionAspect > screenAspect) {
      displayWidth = windowDimensions.width;
      displayHeight = windowDimensions.width / regionAspect;
    } else {
      displayHeight = windowDimensions.height;
      displayWidth = windowDimensions.height * regionAspect;
    }

    // Scale factor from natural region to display
    const scale = displayWidth / naturalRegion.width;

    // Full image size when scaled
    const scaledImageWidth = imageNaturalSize.width * scale;
    const scaledImageHeight = imageNaturalSize.height * scale;

    // Position to center the region
    const offsetX = (windowDimensions.width - displayWidth) / 2;
    const offsetY = (windowDimensions.height - displayHeight) / 2;

    // Image position (negative to shift the region into view)
    const imageX = offsetX - (naturalRegion.x * scale);
    const imageY = offsetY - (naturalRegion.y * scale);

    return {
      displayWidth,
      displayHeight,
      offsetX,
      offsetY,
      imageX,
      imageY,
      scaledImageWidth,
      scaledImageHeight,
      scale,
    };
  };

  // Render focused view
  const renderFocusedView = () => {
    const props = getFocusedViewProps();
    if (!props || !focusRegion) return null;

    // Get holds in region
    const holdsInRegion = getHoldsInRegion();

    // Map detected holds to new coordinate system (relative to focus region)
    const mappedDetectedHolds = holdsInRegion.map(hold => ({
      ...hold,
      polygon: hold.polygon.map(p => ({
        x: ((p.x - focusRegion.x) / focusRegion.width) * 100,
        y: ((p.y - focusRegion.y) / focusRegion.height) * 100,
      })),
      center: {
        x: ((hold.center.x - focusRegion.x) / focusRegion.width) * 100,
        y: ((hold.center.y - focusRegion.y) / focusRegion.height) * 100,
      },
    }));

    // Create fake "holds" from detected holds so RouteOverlay renders them
    const fakeHolds: Hold[] = mappedDetectedHolds.map((dh, index) => ({
      order: index + 1,
      detected_hold_id: dh.id,
      labelX: 0, // Not used since showLabels=false
      labelY: 0,
      note: '',
    }));

    return (
      <Modal visible={true} animationType="fade" statusBarTranslucent>
        <StatusBar hidden />
        <View style={styles.focusedContainer}>
          {/* Clipped image container */}
          <View
            style={{
              position: 'absolute',
              left: props.offsetX,
              top: props.offsetY,
              width: props.displayWidth,
              height: props.displayHeight,
              overflow: 'hidden',
            }}
          >
            <View pointerEvents="none">
              <Image
                source={{ uri: photoUrl }}
                style={{
                  position: 'absolute',
                  left: props.imageX - props.offsetX,
                  top: props.imageY - props.offsetY,
                  width: props.scaledImageWidth,
                  height: props.scaledImageHeight,
                }}
                resizeMode="cover"
              />
            </View>
            {/* Overlay for holds in this region */}
            <RouteOverlay
              holds={fakeHolds}
              detectedHolds={mappedDetectedHolds}
              width={props.displayWidth}
              height={props.displayHeight}
              pointerEvents="auto"
              showLabels={false}
              onHoldPress={handleFocusedHoldPress}
              selectedHoldId={selectedHoldId}
            />
          </View>

          {/* Back button */}
          <TouchableOpacity style={styles.backButton} onPress={exitFocusMode}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          {/* Edit button - show when a hold is selected */}
          {selectedHoldId && (
            <TouchableOpacity style={styles.editButton} onPress={handleEditSelected}>
              <Text style={styles.editButtonText}>Edit Hold</Text>
            </TouchableOpacity>
          )}

          {/* Region info - only show when no hold selected */}
          {!selectedHoldId && (
            <View style={styles.focusInfo}>
              <Text style={styles.focusInfoText}>
                Focused Area • Tap hold to select
              </Text>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // If in focused mode, render the focused view instead
  if (focusMode === 'focused' && focusRegion) {
    return (
      <>
        {renderFocusedView()}
        {/* Delete modal still needs to work */}
        <Modal
          visible={deleteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeModal}
        >
          <TouchableOpacity
            style={baseStyles.modalOverlay}
            activeOpacity={1}
            onPress={closeModal}
          >
            <TouchableOpacity activeOpacity={1} style={baseStyles.modalContent}>
              <Text style={baseStyles.modalTitle}>
                Edit Hold
              </Text>

              {routesUsingHold.length > 0 && (
                <>
                  <Text style={styles.warningText}>
                    Cannot delete - used in {routesUsingHold.length} route(s):
                  </Text>
                  {routesUsingHold.map((title, i) => (
                    <Text key={i} style={styles.routeListItem}>• {title}</Text>
                  ))}
                </>
              )}

              <TouchableOpacity
                style={[baseStyles.modalButton, baseStyles.modalButtonDanger]}
                onPress={handleDeleteHold}
                disabled={isDeleting || routesUsingHold.length > 0}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={baseStyles.modalButtonText}>Delete Hold</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
                onPress={closeModal}
              >
                <Text style={baseStyles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  return (
    <FullScreenImageBase
      visible={visible}
      photoUrl={photoUrl}
      holds={holds}
      detectedHolds={detectedHolds}
      onClose={focusMode === 'selecting' ? cancelSelection : onClose}
      showLabels={false}
      closeButtonText={focusMode === 'selecting' ? 'Cancel' : '✕'}
      overlayPointerEvents="none"
      onImageTap={focusMode === 'selecting' ? handleSelectingTap : handleImageTap}
      onDimensionsReady={handleDimensionsReady}
      selectedHoldId={selectedHoldId}
    >
      {/* Focus Area button - only show when not in selecting mode and no hold selected */}
      {focusMode === 'none' && !selectedHoldId && (
        <TouchableOpacity style={styles.focusButton} onPress={startFocusSelection}>
          <Text style={styles.focusButtonText}>Focus Area</Text>
        </TouchableOpacity>
      )}

      {/* Edit button - show when a hold is selected */}
      {selectedHoldId && focusMode === 'none' && (
        <TouchableOpacity style={styles.editButton} onPress={handleEditSelected}>
          <Text style={styles.editButtonText}>Edit Hold</Text>
        </TouchableOpacity>
      )}

      {/* Selection mode helper */}
      {focusMode === 'selecting' && (
        <View style={styles.selectionHelper}>
          <Text style={styles.selectionHelperText}>
            Tap to zoom into area
          </Text>
        </View>
      )}

      {/* Delete Hold Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={baseStyles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <TouchableOpacity activeOpacity={1} style={baseStyles.modalContent}>
            <Text style={baseStyles.modalTitle}>
              Edit Hold
            </Text>

            {routesUsingHold.length > 0 && (
              <>
                <Text style={styles.warningText}>
                  Cannot delete - used in {routesUsingHold.length} route(s):
                </Text>
                {routesUsingHold.map((title, i) => (
                  <Text key={i} style={styles.routeListItem}>• {title}</Text>
                ))}
              </>
            )}

            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonDanger]}
              onPress={handleDeleteHold}
              disabled={isDeleting || routesUsingHold.length > 0}
            >
              {isDeleting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={baseStyles.modalButtonText}>Delete Hold</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
              onPress={closeModal}
            >
              <Text style={baseStyles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </FullScreenImageBase>
  );
}

const styles = StyleSheet.create({
  warningText: {
    fontSize: 14,
    color: '#dc3545',
    marginBottom: 8,
  },
  routeListItem: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    marginBottom: 4,
  },
  focusButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 102, 204, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  focusButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  editButton: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 102, 204, 0.95)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  selectionHelper: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  selectionHelperText: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  focusedContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  focusInfo: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  focusInfoText: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
  },
});
