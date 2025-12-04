import { useState, useEffect, useRef } from 'react';
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
  PanResponder,
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
  const [radiusModalVisible, setRadiusModalVisible] = useState(false);
  const [radiusText, setRadiusText] = useState('');
  const [draggingHoldIndex, setDraggingHoldIndex] = useState<number | null>(null);
  const [draggingLabelIndex, setDraggingLabelIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);

  // Refs for dragging state (to avoid stale closure values in PanResponder)
  const holdsRef = useRef<Hold[]>(holds);
  const draggingHoldIndexRef = useRef<number | null>(null);
  const draggingLabelIndexRef = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Keep holdsRef in sync with holds state
  useEffect(() => {
    holdsRef.current = holds;
  }, [holds]);

  useEffect(() => {
    setHolds(initialHolds);
  }, [initialHolds]);

  useEffect(() => {
    if (visible) {
      console.log('[Dimensions] Getting image size for:', photoUrl);
      Image.getSize(photoUrl, (width, height) => {
        console.log('[Dimensions] Got natural size:', width, 'x', height);
        setImageNaturalSize({ width, height });
      });
    }
  }, [visible, photoUrl]);

  useEffect(() => {
    console.log('[Dimensions] displayedDimensions updated:', displayedDimensions.width, 'x', displayedDimensions.height);
  }, [displayedDimensions]);

  // Calculate actual displayed image dimensions based on contain mode
  const getDisplayedImageDimensions = () => {
    console.log('[Calc] imageNaturalSize:', imageNaturalSize.width, 'x', imageNaturalSize.height);
    console.log('[Calc] windowDimensions:', windowDimensions.width, 'x', windowDimensions.height);

    if (!imageNaturalSize.width || !imageNaturalSize.height) {
      console.log('[Calc] Returning 0x0 - no natural size');
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

    console.log('[Calc] Calculated dimensions:', displayWidth, 'x', displayHeight);
    return { width: displayWidth, height: displayHeight };
  };

  const displayedDimensions = getDisplayedImageDimensions();

  // Store dimensions in ref so PanResponder can access current value
  const displayedDimensionsRef = useRef(displayedDimensions);
  displayedDimensionsRef.current = displayedDimensions;

  // Calculate scale factors to map hold coordinates to displayed image size
  const scaleX = displayedDimensions.width / imageNaturalSize.width || 1;
  const scaleY = displayedDimensions.height / imageNaturalSize.height || 1;

  // Calculate centering offsets for SVG overlay
  const offsetX = (windowDimensions.width - displayedDimensions.width) / 2;
  const offsetY = (windowDimensions.height - displayedDimensions.height) / 2;

  // Store offsets in ref too
  const offsetXRef = useRef(offsetX);
  const offsetYRef = useRef(offsetY);
  offsetXRef.current = offsetX;
  offsetYRef.current = offsetY;

  // Pan responder for dragging holds and labels
  const checkIfTouchingHoldOrLabel = (touchX: number, touchY: number) => {
    // Use refs to get current values instead of stale closure values
    const currentDimensions = displayedDimensionsRef.current;
    const currentOffsetX = offsetXRef.current;
    const currentOffsetY = offsetYRef.current;

    const imageX = touchX - currentOffsetX;
    const imageY = touchY - currentOffsetY;

    console.log('[Check] Touch:', touchX, touchY, '-> Image coords:', imageX, imageY, '(offset:', currentOffsetX, currentOffsetY, ')');
    console.log('[Check] Image dimensions:', currentDimensions.width, 'x', currentDimensions.height);

    if (imageX < 0 || imageX > currentDimensions.width ||
        imageY < 0 || imageY > currentDimensions.height) {
      console.log('[Check] Touch outside image bounds');
      return null;
    }

    const xPercent = (imageX / currentDimensions.width) * 100;
    const yPercent = (imageY / currentDimensions.height) * 100;
    console.log('[Check] Touch percent:', xPercent, yPercent);

    const currentHolds = holdsRef.current;
    console.log('[Check] Holds count:', currentHolds.length);

    // Check holds first (smaller hit area, higher priority)
    for (let i = 0; i < currentHolds.length; i++) {
      const hold = currentHolds[i];
      const dx = xPercent - hold.holdX;
      const dy = yPercent - hold.holdY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      console.log('[Check] Hold', i, 'at', hold.holdX, hold.holdY, 'radius:', hold.radius, 'distance:', distance);

      if (distance < hold.radius + 2) {
        console.log('[Check] HIT on hold', i);
        return { type: 'hold', index: i, offsetX: dx, offsetY: dy };
      }
    }

    // Check labels
    for (let i = 0; i < currentHolds.length; i++) {
      const hold = currentHolds[i];
      const labelText = hold.note ? `${hold.order}. ${hold.note}` : `${hold.order}`;
      const textWidth = (labelText.length * 8) / currentDimensions.width * 100;
      const textHeight = 18 / currentDimensions.height * 100;
      const padding = 4 / currentDimensions.width * 100;

      const labelLeft = hold.labelX - padding;
      const labelRight = hold.labelX + textWidth + padding;
      const labelTop = hold.labelY - textHeight + padding;
      const labelBottom = hold.labelY + padding;

      if (xPercent >= labelLeft && xPercent <= labelRight &&
          yPercent >= labelTop && yPercent <= labelBottom) {
        console.log('[Check] HIT on label', i);
        return { type: 'label', index: i, offsetX: xPercent - hold.labelX, offsetY: yPercent - hold.labelY };
      }
    }

    console.log('[Check] No hit');
    return null;
  };

  const handleImageTap = (event: any) => {
    // Use refs to get current values
    const currentDimensions = displayedDimensionsRef.current;
    const currentOffsetX = offsetXRef.current;
    const currentOffsetY = offsetYRef.current;

    if (!editable || currentDimensions.width === 0) return;

    const touchX = event.locationX || event.nativeEvent?.pageX || 0;
    const touchY = event.locationY || event.nativeEvent?.pageY || 0;

    const imageX = touchX - currentOffsetX;
    const imageY = touchY - currentOffsetY;

    if (imageX < 0 || imageX > currentDimensions.width ||
        imageY < 0 || imageY > currentDimensions.height) {
      return;
    }

    const xPercent = (imageX / currentDimensions.width) * 100;
    const yPercent = (imageY / currentDimensions.height) * 100;

    // Check if tapped on a hold
    for (let i = 0; i < holds.length; i++) {
      const hold = holds[i];
      const dx = xPercent - hold.holdX;
      const dy = yPercent - hold.holdY;
      const distance = Math.sqrt(dx * dx + dy * dy);

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

  // Note: We don't use ImageZoom's onMove because it doesn't provide touch coordinates
  // Drag-to-move is handled entirely by PanResponder below

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) => {
        const currentDimensions = displayedDimensionsRef.current;
        const currentOffsetX = offsetXRef.current;
        const currentOffsetY = offsetYRef.current;

        if (!editable || currentDimensions.width === 0) {
          console.log('[PanResponder] onStartCapture - early return, editable:', editable, 'dimensions:', currentDimensions.width, 'x', currentDimensions.height);
          return false;
        }

        const touchX = evt.nativeEvent.pageX;
        const touchY = evt.nativeEvent.pageY;
        console.log('[PanResponder] onStartCapture - touch at', touchX, touchY, 'offsets:', currentOffsetX, currentOffsetY);

        // Capture if starting on a hold or label (blocks ImageZoom)
        const touched = checkIfTouchingHoldOrLabel(touchX, touchY);
        const shouldCapture = touched !== null;
        console.log('[PanResponder] onStartCapture - touched:', touched ? `${touched.type} #${touched.index}` : 'nothing', '- capturing:', shouldCapture);
        return shouldCapture;
      },
      onStartShouldSetPanResponder: (evt) => {
        // Don't claim if dimensions aren't ready
        const currentDimensions = displayedDimensionsRef.current;
        if (!editable || currentDimensions.width === 0) {
          console.log('[PanResponder] onStart - early return, editable:', editable, 'dimensions:', currentDimensions.width, 'x', currentDimensions.height);
          return false;
        }

        // Only claim if touching a hold/label
        const touched = checkIfTouchingHoldOrLabel(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        console.log('[PanResponder] onStart - shouldClaim:', touched !== null);
        return touched !== null;
      },
      onMoveShouldSetPanResponder: () => false,
      onPanResponderGrant: (evt, gestureState) => {
        console.log('[PanResponder] onGrant - gesture claimed');
        if (!editable) return;

        const touched = checkIfTouchingHoldOrLabel(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        if (!touched) {
          console.log('[PanResponder] onGrant - no touched item found');
          return;
        }

        console.log('[PanResponder] onGrant - setting drag state for', touched.type, '#', touched.index);
        if (touched.type === 'hold') {
          draggingHoldIndexRef.current = touched.index;
          dragOffsetRef.current = { x: touched.offsetX, y: touched.offsetY };
          setDraggingHoldIndex(touched.index);
          setDragOffset({ x: touched.offsetX, y: touched.offsetY });
        } else if (touched.type === 'label') {
          draggingLabelIndexRef.current = touched.index;
          dragOffsetRef.current = { x: touched.offsetX, y: touched.offsetY };
          setDraggingLabelIndex(touched.index);
          setDragOffset({ x: touched.offsetX, y: touched.offsetY });
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const currentDraggingHold = draggingHoldIndexRef.current;
        const currentDraggingLabel = draggingLabelIndexRef.current;
        const currentDragOffset = dragOffsetRef.current;

        if (!editable || (currentDraggingHold === null && currentDraggingLabel === null)) return;

        // Use refs to get current values
        const currentDimensions = displayedDimensionsRef.current;
        const currentOffsetX = offsetXRef.current;
        const currentOffsetY = offsetYRef.current;

        const touchX = evt.nativeEvent.pageX;
        const touchY = evt.nativeEvent.pageY;

        const imageX = touchX - currentOffsetX;
        const imageY = touchY - currentOffsetY;

        if (imageX < 0 || imageX > currentDimensions.width ||
            imageY < 0 || imageY > currentDimensions.height) {
          return;
        }

        const xPercent = (imageX / currentDimensions.width) * 100;
        const yPercent = (imageY / currentDimensions.height) * 100;

        const currentHolds = holdsRef.current;

        if (currentDraggingHold !== null) {
          const hold = currentHolds[currentDraggingHold];
          const newHoldX = xPercent - currentDragOffset.x;
          const newHoldY = yPercent - currentDragOffset.y;

          // Calculate label offset to maintain relative position
          const labelOffsetX = hold.labelX - hold.holdX;
          const labelOffsetY = hold.labelY - hold.holdY;

          const updatedHolds = currentHolds.map((h, i) =>
            i === currentDraggingHold
              ? {
                  ...h,
                  holdX: newHoldX,
                  holdY: newHoldY,
                  labelX: newHoldX + labelOffsetX,
                  labelY: newHoldY + labelOffsetY,
                }
              : h
          );
          setHolds(updatedHolds);
        } else if (currentDraggingLabel !== null) {
          const newLabelX = xPercent - currentDragOffset.x;
          const newLabelY = yPercent - currentDragOffset.y;

          const updatedHolds = currentHolds.map((h, i) =>
            i === currentDraggingLabel
              ? { ...h, labelX: newLabelX, labelY: newLabelY }
              : h
          );
          setHolds(updatedHolds);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const currentDraggingHold = draggingHoldIndexRef.current;
        const currentDraggingLabel = draggingLabelIndexRef.current;

        const wasDragging = currentDraggingHold !== null || currentDraggingLabel !== null;
        const actuallyMoved = Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
        console.log('[PanResponder] onRelease - wasDragging:', wasDragging, 'actuallyMoved:', actuallyMoved, 'dx:', gestureState.dx, 'dy:', gestureState.dy);

        // If it was a tap (no movement), open edit modal
        if (wasDragging && !actuallyMoved && currentDraggingHold !== null) {
          console.log('[PanResponder] onRelease - opening edit modal for hold', currentDraggingHold);
          setSelectedHoldIndex(currentDraggingHold);
          setEditModalVisible(true);
        }

        // Clear refs
        draggingHoldIndexRef.current = null;
        draggingLabelIndexRef.current = null;
        dragOffsetRef.current = { x: 0, y: 0 };

        // Clear state
        setDraggingHoldIndex(null);
        setDraggingLabelIndex(null);
        setDragOffset({ x: 0, y: 0 });
      },
    })
  ).current;

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
        <ImageZoom
          cropWidth={windowDimensions.width}
          cropHeight={windowDimensions.height}
          imageWidth={windowDimensions.width}
          imageHeight={windowDimensions.height}
          minScale={1}
          maxScale={4}
          onClick={editable ? handleImageTap : undefined}
        >
          <View
            style={{ width: windowDimensions.width, height: windowDimensions.height }}
            {...(editable ? panResponder.panHandlers : {})}
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
          style={styles.closeButton}
          onPress={handleDone}
        >
          <Text style={styles.closeButtonText}>{editable ? '✓' : '✕'}</Text>
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
