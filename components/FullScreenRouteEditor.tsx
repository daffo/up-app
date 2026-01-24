import React, { useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  Dimensions,
  Alert,
  TextInput,
} from 'react-native';
import ImageZoom from 'react-native-image-pan-zoom';
import { Hold, DetectedHold } from '../types/database.types';
import RouteOverlay from './RouteOverlay';
import { isPointInPolygon, findSmallestPolygonAtPoint } from '../utils/polygon';

interface FullScreenRouteEditorProps {
  visible: boolean;
  photoUrl: string;
  holds: Hold[];
  detectedHolds: DetectedHold[]; // All detected holds for this photo
  onClose: () => void;
  onUpdateHolds: (holds: Hold[]) => void;
}

export default function FullScreenRouteEditor({
  visible,
  photoUrl,
  holds: initialHolds,
  detectedHolds,
  onClose,
  onUpdateHolds,
}: FullScreenRouteEditorProps) {
  const [holds, setHolds] = useState<Hold[]>(initialHolds);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [selectedHoldIndex, setSelectedHoldIndex] = useState<number | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [movingMode, setMovingMode] = useState<'hold' | 'label' | null>(null);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const availableHeight = screenHeight - 100; // Account for header

  React.useEffect(() => {
    setHolds(initialHolds);
  }, [initialHolds]);

  React.useEffect(() => {
    if (photoUrl) {
      Image.getSize(photoUrl, (width, height) => {
        setImageNaturalSize({ width, height });
      });
    }
  }, [photoUrl]);

  // Calculate actual displayed image dimensions based on contain mode
  const getDisplayedImageDimensions = () => {
    if (!imageNaturalSize.width || !imageNaturalSize.height) {
      return { width: 0, height: 0 };
    }

    const imageAspect = imageNaturalSize.width / imageNaturalSize.height;
    const containerAspect = screenWidth / availableHeight;

    let displayWidth, displayHeight;

    if (imageAspect > containerAspect) {
      // Image is wider - constrained by width
      displayWidth = screenWidth;
      displayHeight = screenWidth / imageAspect;
    } else {
      // Image is taller - constrained by height
      displayHeight = availableHeight;
      displayWidth = availableHeight * imageAspect;
    }

    return { width: displayWidth, height: displayHeight };
  };

  const displayedDimensions = getDisplayedImageDimensions();

  // Calculate centering offsets for overlay
  const offsetX = (screenWidth - displayedDimensions.width) / 2;
  const offsetY = (availableHeight - displayedDimensions.height) / 2;


  const handleImagePress = (event: any) => {
    if (displayedDimensions.width === 0) return;

    const { locationX, locationY } = event;

    // Convert screen coordinates to image-relative coordinates
    const imageX = locationX - offsetX;
    const imageY = locationY - offsetY;

    // Check if tap is outside the image bounds
    if (imageX < 0 || imageX > displayedDimensions.width ||
        imageY < 0 || imageY > displayedDimensions.height) {
      return;
    }

    // Convert to percentages relative to displayed image
    const xPercent = (imageX / displayedDimensions.width) * 100;
    const yPercent = (imageY / displayedDimensions.height) * 100;

    // If in moving mode, update position
    if (movingMode && selectedHoldIndex !== null) {
      const updatedHolds = holds.map((hold, i) => {
        if (i === selectedHoldIndex) {
          if (movingMode === 'label') {
            return { ...hold, labelX: xPercent, labelY: yPercent };
          }
        }
        return hold;
      });

      setHolds(updatedHolds);
      setMovingMode(null);
      setSelectedHoldIndex(null);
      return;
    }

    // Build list of route holds with their polygons for lookup
    const routeHoldsWithPolygons = holds
      .map((hold, index) => {
        const detectedHold = detectedHolds.find(dh => dh.id === hold.detected_hold_id);
        return detectedHold ? { index, polygon: detectedHold.polygon } : null;
      })
      .filter((h): h is { index: number; polygon: Array<{ x: number; y: number }> } => h !== null);

    // Check if tapped on an existing hold in the route (prioritize smallest)
    const smallestRouteHold = findSmallestPolygonAtPoint(xPercent, yPercent, routeHoldsWithPolygons);
    if (smallestRouteHold) {
      setSelectedHoldIndex(smallestRouteHold.index);
      setEditModalVisible(true);
      return;
    }

    // Check if tapped on any detected hold to add to route (prioritize smallest)
    const smallestDetectedHold = findSmallestPolygonAtPoint(xPercent, yPercent, detectedHolds);
    if (smallestDetectedHold) {
      // Check if this hold is already in the route
      const alreadyUsed = holds.some(h => h.detected_hold_id === smallestDetectedHold.id);
      if (alreadyUsed) {
        Alert.alert('Hold Already Used', 'This hold is already part of the route.');
        return;
      }

      // Add new hold to route
      const newHold: Hold = {
        order: holds.length + 1,
        detected_hold_id: smallestDetectedHold.id,
        labelX: xPercent + 3,
        labelY: yPercent - 3,
        note: '',
      };

      setHolds([...holds, newHold]);
      return;
    }

    // No hold detected at tap location
    Alert.alert('No Hold', 'Tap on a detected hold to add it to the route.');
  };

  const handleDeleteHold = () => {
    if (selectedHoldIndex === null) return;

    const updatedHolds = holds.filter((_, i) => i !== selectedHoldIndex);
    const renumberedHolds = updatedHolds.map((hold, i) => ({
      ...hold,
      order: i + 1,
    }));

    setHolds(renumberedHolds);
    setEditModalVisible(false);
    setSelectedHoldIndex(null);
  };

  const handleMoveLabel = () => {
    setMovingMode('label');
    setEditModalVisible(false);
  };

  const handleOpenNoteModal = () => {
    if (selectedHoldIndex !== null) {
      setNoteText(holds[selectedHoldIndex].note || '');
      setNoteModalVisible(true);
      setEditModalVisible(false);
    }
  };

  const handleSaveNote = () => {
    if (selectedHoldIndex !== null) {
      const updatedHolds = holds.map((hold, i) =>
        i === selectedHoldIndex ? { ...hold, note: noteText } : hold
      );
      setHolds(updatedHolds);
    }
    setNoteModalVisible(false);
    setSelectedHoldIndex(null);
  };

  const handleDone = () => {
    onUpdateHolds(holds);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleDone}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Edit Holds ({holds.length})</Text>
          <TouchableOpacity onPress={handleDone} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Moving mode helper */}
        {movingMode && (
          <View style={styles.helperBanner}>
            <Text style={styles.helperText}>
              Tap to move label position
            </Text>
          </View>
        )}

        {/* Image with zoom */}
        <ImageZoom
          cropWidth={screenWidth}
          cropHeight={availableHeight}
          imageWidth={screenWidth}
          imageHeight={availableHeight}
          minScale={1}
          maxScale={4}
          onClick={handleImagePress}
        >
          <View style={{ width: screenWidth, height: availableHeight }}>
            <Image
              source={{ uri: photoUrl }}
              style={{ width: screenWidth, height: availableHeight }}
              resizeMode="contain"
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
                />
              </View>
            )}
          </View>
        </ImageZoom>

        {/* Edit Hold Modal */}
        <Modal
          visible={editModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setEditModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Edit Hold {selectedHoldIndex !== null ? holds[selectedHoldIndex]?.order : ''}
              </Text>

              <TouchableOpacity style={styles.modalButton} onPress={handleOpenNoteModal}>
                <Text style={styles.modalButtonText}>📝 Edit Note</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalButton} onPress={handleMoveLabel}>
                <Text style={styles.modalButtonText}>🏷️ Move Label Position</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleDeleteHold}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonDangerText]}>
                  🗑️ Delete Hold
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Note Edit Modal */}
        <Modal
          visible={noteModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setNoteModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setNoteModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Note</Text>
              <TextInput
                style={styles.noteInput}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Enter note (optional)"
                multiline
                autoFocus
              />
              <TouchableOpacity style={styles.modalButton} onPress={handleSaveNote}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setNoteModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  doneButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helperBanner: {
    backgroundColor: '#0066cc',
    padding: 12,
  },
  helperText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
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
  modalButtonDangerText: {
    color: '#fff',
  },
  modalButtonCancel: {
    backgroundColor: '#6c757d',
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
