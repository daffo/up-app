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
  TextInput,
} from 'react-native';
import ImageZoom from 'react-native-image-pan-zoom';
import { Hold } from '../types/database.types';
import RouteOverlay from './RouteOverlay';

interface FullScreenRouteViewerProps {
  visible: boolean;
  photoUrl: string;
  holds: Hold[];
  onClose: () => void;
  editable?: boolean;
  onUpdateHolds?: (holds: Hold[]) => void;
}

export default function FullScreenRouteViewer({
  visible,
  photoUrl,
  holds: initialHolds,
  onClose,
  editable = false,
  onUpdateHolds,
}: FullScreenRouteViewerProps) {
  const windowDimensions = useWindowDimensions();
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [holds, setHolds] = useState<Hold[]>(initialHolds);
  const [selectedHoldIndex, setSelectedHoldIndex] = useState<number | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [movingMode, setMovingMode] = useState<'hold' | 'label' | null>(null);
  const [radiusModalVisible, setRadiusModalVisible] = useState(false);
  const [radiusText, setRadiusText] = useState('');

  useEffect(() => {
    setHolds(initialHolds);
  }, [initialHolds]);

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

  const handleImagePress = (event: any) => {
    if (!editable || displayedDimensions.width === 0) return;

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
          if (movingMode === 'hold') {
            return { ...hold, holdX: xPercent, holdY: yPercent };
          } else if (movingMode === 'label') {
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

    // Check if tapped on an existing hold
    for (let i = 0; i < holds.length; i++) {
      const hold = holds[i];
      const dx = xPercent - hold.holdX;
      const dy = yPercent - hold.holdY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if tap is within hold radius (with some padding)
      if (distance < hold.radius + 2) {
        setSelectedHoldIndex(i);
        setEditModalVisible(true);
        return;
      }
    }

    // Place new hold
    const newHold: Hold = {
      order: holds.length + 1,
      holdX: xPercent,
      holdY: yPercent,
      labelX: xPercent + 3,
      labelY: yPercent - 3,
      radius: 2.5,
      note: '',
    };

    setHolds([...holds, newHold]);
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

  const handleMoveHold = () => {
    setMovingMode('hold');
    setEditModalVisible(false);
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

  const handleOpenRadiusModal = () => {
    if (selectedHoldIndex !== null) {
      setRadiusText(holds[selectedHoldIndex].radius.toString());
      setRadiusModalVisible(true);
      setEditModalVisible(false);
    }
  };

  const handleSaveRadius = () => {
    if (selectedHoldIndex !== null) {
      const newRadius = parseFloat(radiusText);
      if (!isNaN(newRadius) && newRadius > 0 && newRadius <= 10) {
        const updatedHolds = holds.map((hold, i) =>
          i === selectedHoldIndex ? { ...hold, radius: newRadius } : hold
        );
        setHolds(updatedHolds);
      }
    }
    setRadiusModalVisible(false);
    setSelectedHoldIndex(null);
  };

  const handleDone = () => {
    if (editable && onUpdateHolds) {
      onUpdateHolds(holds);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={handleDone}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Moving mode helper */}
        {editable && movingMode && (
          <View style={styles.helperBanner}>
            <Text style={styles.helperText}>
              {movingMode === 'hold' ? 'Tap to move hold position' : 'Tap to move label position'}
            </Text>
          </View>
        )}

        <ImageZoom
          cropWidth={windowDimensions.width}
          cropHeight={windowDimensions.height}
          imageWidth={windowDimensions.width}
          imageHeight={windowDimensions.height}
          minScale={1}
          maxScale={4}
          onClick={editable ? handleImagePress : undefined}
        >
          <View style={{ width: windowDimensions.width, height: windowDimensions.height }}>
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
                pointerEvents="none"
              >
                <RouteOverlay
                  holds={holds}
                  width={displayedDimensions.width}
                  height={displayedDimensions.height}
                  pointerEvents="none"
                />
              </View>
            )}
          </View>
        </ImageZoom>

        {/* Close/Done button */}
        <TouchableOpacity
          style={editable ? styles.doneButton : styles.closeButton}
          onPress={handleDone}
        >
          {editable ? (
            <Text style={styles.doneButtonText}>Done ({holds.length})</Text>
          ) : (
            <Text style={styles.closeButtonText}>✕</Text>
          )}
        </TouchableOpacity>

        {/* Edit Hold Modal */}
        {editable && (
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

                <TouchableOpacity style={styles.modalButton} onPress={handleOpenRadiusModal}>
                  <Text style={styles.modalButtonText}>⭕ Change Size</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalButton} onPress={handleMoveHold}>
                  <Text style={styles.modalButtonText}>📍 Move Hold Position</Text>
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
        )}

        {/* Note Edit Modal */}
        {editable && (
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
        )}

        {/* Radius Edit Modal */}
        {editable && (
          <Modal
            visible={radiusModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setRadiusModalVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setRadiusModalVisible(false)}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Change Size</Text>
                <Text style={styles.helperText}>Enter radius as percentage (0.5 - 10)</Text>
                <TextInput
                  style={styles.noteInput}
                  value={radiusText}
                  onChangeText={setRadiusText}
                  placeholder="e.g., 2.5"
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <TouchableOpacity style={styles.modalButton} onPress={handleSaveRadius}>
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => setRadiusModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
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
  doneButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helperBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0066cc',
    padding: 12,
    zIndex: 10,
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
