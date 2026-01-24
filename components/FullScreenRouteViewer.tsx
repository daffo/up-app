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
import { Hold, DetectedHold } from '../types/database.types';
import RouteOverlay from './RouteOverlay';

interface FullScreenRouteViewerProps {
  visible: boolean;
  photoUrl: string;
  holds: Hold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  editable?: boolean;
  onUpdateHolds?: (holds: Hold[]) => void;
  showLabels?: boolean;
}

export default function FullScreenRouteViewer({
  visible,
  photoUrl,
  holds: initialHolds,
  detectedHolds,
  onClose,
  editable = false,
  onUpdateHolds,
  showLabels = true,
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
  const [resizingHoldIndex, setResizingHoldIndex] = useState<number | null>(null);

  // Zoom state tracking for PanResponder coordinate transformation
  const zoomStateRef = useRef({ scale: 1, positionX: 0, positionY: 0 });

  // Refs for dragging state (to avoid stale closure values in PanResponder)
  const holdsRef = useRef<Hold[]>(holds);
  const draggingHoldIndexRef = useRef<number | null>(null);
  const draggingLabelIndexRef = useRef<number | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizingHoldIndexRef = useRef<number | null>(null);

  // Keep holdsRef in sync with holds state
  useEffect(() => {
    holdsRef.current = holds;
  }, [holds]);

  // Keep resizingHoldIndexRef in sync
  useEffect(() => {
    resizingHoldIndexRef.current = resizingHoldIndex;
  }, [resizingHoldIndex]);

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
    const currentZoom = zoomStateRef.current;
    const currentResizing = resizingHoldIndexRef.current;

    // Transform PanResponder coordinates to account for zoom and pan
    // Use original offset (where SVG is positioned), not scaled offset
    const imageX = (touchX - currentOffsetX - currentZoom.positionX) / currentZoom.scale;
    const imageY = (touchY - currentOffsetY - currentZoom.positionY) / currentZoom.scale;

    const xPercent = (imageX / currentDimensions.width) * 100;
    const yPercent = (imageY / currentDimensions.height) * 100;

    if (imageX < 0 || imageX > currentDimensions.width ||
        imageY < 0 || imageY > currentDimensions.height) {
      return null;
    }

    const currentHolds = holdsRef.current;

    // Check resize handle first if in resize mode
    if (currentResizing !== null) {
      const hold = currentHolds[currentResizing];
      // Handle is at 45 degrees (top-right)
      const angle = -Math.PI / 4; // -45 degrees (top-right)
      const handleX = hold.holdX + hold.radius * Math.cos(angle);
      const handleY = hold.holdY + hold.radius * Math.sin(angle);
      const handleRadius = 1.5; // Handle size in percent

      const dx = xPercent - handleX;
      const dy = yPercent - handleY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < handleRadius + 1) {
        return { type: 'resize-handle', index: currentResizing, offsetX: 0, offsetY: 0 };
      }
    }

    // Check holds first (smaller hit area, higher priority)
    for (let i = 0; i < currentHolds.length; i++) {
      const hold = currentHolds[i];
      const dx = xPercent - hold.holdX;
      const dy = yPercent - hold.holdY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < hold.radius + 2) {
        return { type: 'hold', index: i, offsetX: dx, offsetY: dy };
      }
    }

    // Check labels
    for (let i = 0; i < currentHolds.length; i++) {
      const hold = currentHolds[i];
      const labelText = hold.note ? `${hold.order}. ${hold.note}` : `${hold.order}`;
      const lines = labelText.split('\n');
      const maxLineLength = Math.max(...lines.map(line => line.length));
      const textWidth = (maxLineLength * 6.5) / currentDimensions.width * 100;
      const lineHeight = 13 / currentDimensions.height * 100;
      const totalTextHeight = lines.length * lineHeight;
      const padding = 1 / currentDimensions.width * 100; // Minimal padding

      const labelLeft = hold.labelX;
      const labelRight = hold.labelX + textWidth + padding * 2;
      const labelTop = hold.labelY - totalTextHeight - padding;
      const labelBottom = hold.labelY + padding;

      if (xPercent >= labelLeft && xPercent <= labelRight &&
          yPercent >= labelTop && yPercent <= labelBottom) {
        return { type: 'label', index: i, offsetX: xPercent - hold.labelX, offsetY: yPercent - hold.labelY };
      }
    }

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
        // Enter edit mode directly
        setResizingHoldIndex(i);
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
        const currentResizing = resizingHoldIndexRef.current;

        if (!editable || currentDimensions.width === 0) {
          return false;
        }

        const touchX = evt.nativeEvent.pageX;
        const touchY = evt.nativeEvent.pageY;

        // Check what was touched
        const touched = checkIfTouchingHoldOrLabel(touchX, touchY);

        // If in resize mode, only capture if touching the resize handle
        if (currentResizing !== null) {
          return touched?.type === 'resize-handle';
        }

        // Otherwise capture if starting on a hold or label (blocks ImageZoom)
        const shouldCapture = touched !== null;
        return shouldCapture;
      },
      onStartShouldSetPanResponder: (evt) => {
        // Don't claim if dimensions aren't ready
        const currentDimensions = displayedDimensionsRef.current;
        if (!editable || currentDimensions.width === 0) {
          return false;
        }

        // Only claim if touching a hold/label
        const touched = checkIfTouchingHoldOrLabel(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        return touched !== null;
      },
      onMoveShouldSetPanResponder: () => false,
      onPanResponderTerminationRequest: () => {
        // Never let ImageZoom steal our gesture once we've claimed it
        const currentDragging = draggingHoldIndexRef.current !== null ||
                               draggingLabelIndexRef.current !== null ||
                               resizingHoldIndexRef.current !== null;
        return !currentDragging;
      },
      onPanResponderGrant: (evt, gestureState) => {
        if (!editable) return;

        // Disable dragging when zoomed in
        const currentZoom = zoomStateRef.current;
        if (currentZoom.scale > 1) {
          return;
        }

        const currentResizing = resizingHoldIndexRef.current;
        const touched = checkIfTouchingHoldOrLabel(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        if (!touched) {
          return;
        }

        // If touching resize handle, don't set up drag state (we're resizing)
        if (touched.type === 'resize-handle') {
          return;
        }

        // Skip drag state setup if in resize mode (and not on handle)
        if (currentResizing !== null) {
          return;
        }

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
        const currentResizing = resizingHoldIndexRef.current;
        const currentDraggingHold = draggingHoldIndexRef.current;
        const currentDraggingLabel = draggingLabelIndexRef.current;
        const currentDragOffset = dragOffsetRef.current;

        if (!editable) return;

        // Use refs to get current values
        const currentDimensions = displayedDimensionsRef.current;
        const currentOffsetX = offsetXRef.current;
        const currentOffsetY = offsetYRef.current;
        const currentHolds = holdsRef.current;
        const currentZoom = zoomStateRef.current;

        const touchX = evt.nativeEvent.pageX;
        const touchY = evt.nativeEvent.pageY;

        // Transform PanResponder coordinates to account for zoom and pan
        // Use original offset (where SVG is positioned), not scaled offset
        const imageX = (touchX - currentOffsetX - currentZoom.positionX) / currentZoom.scale;
        const imageY = (touchY - currentOffsetY - currentZoom.positionY) / currentZoom.scale;

        if (imageX < 0 || imageX > currentDimensions.width ||
            imageY < 0 || imageY > currentDimensions.height) {
          return;
        }

        const xPercent = (imageX / currentDimensions.width) * 100;
        const yPercent = (imageY / currentDimensions.height) * 100;

        // Handle resize mode
        if (currentResizing !== null) {
          const hold = currentHolds[currentResizing];
          const dx = xPercent - hold.holdX;
          const dy = yPercent - hold.holdY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Clamp radius between 0.5 and 10 percent
          const newRadius = Math.max(0.5, Math.min(10, distance));

          const updatedHolds = currentHolds.map((h, i) =>
            i === currentResizing ? { ...h, radius: newRadius } : h
          );
          setHolds(updatedHolds);
          return;
        }

        // Handle normal drag mode
        if (currentDraggingHold === null && currentDraggingLabel === null) return;

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
        const currentResizing = resizingHoldIndexRef.current;
        const currentDraggingHold = draggingHoldIndexRef.current;
        const currentDraggingLabel = draggingLabelIndexRef.current;

        const actuallyMoved = Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;

        // If in resize mode and didn't move (tapped handle), exit resize mode
        if (currentResizing !== null && !actuallyMoved) {
          setResizingHoldIndex(null);
          return;
        }

        const wasDragging = currentDraggingHold !== null || currentDraggingLabel !== null;

        // If it was a tap (no movement), enter edit mode
        if (wasDragging && !actuallyMoved && currentDraggingHold !== null) {
          setResizingHoldIndex(currentDraggingHold);
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
    if (resizingHoldIndex === null) return;

    const updatedHolds = holds.filter((_, i) => i !== resizingHoldIndex);
    const renumberedHolds = updatedHolds.map((hold, i) => ({
      ...hold,
      order: i + 1,
    }));

    setHolds(renumberedHolds);
    setResizingHoldIndex(null);
    setSelectedHoldIndex(null);
  };

  const handleOpenNoteModal = () => {
    if (resizingHoldIndex !== null) {
      setNoteText(holds[resizingHoldIndex].note || '');
      setNoteModalVisible(true);
    }
  };

  const handleSaveNote = () => {
    if (resizingHoldIndex !== null) {
      const updatedHolds = holds.map((hold, i) =>
        i === resizingHoldIndex ? { ...hold, note: noteText } : hold
      );
      setHolds(updatedHolds);
    }
    setNoteModalVisible(false);
  };

  const handleOpenRadiusModal = () => {
    if (selectedHoldIndex !== null) {
      // Enter resize mode instead of showing text input modal
      setResizingHoldIndex(selectedHoldIndex);
      setEditModalVisible(false);
      setSelectedHoldIndex(null);
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
          onMove={(position) => {
            // Track zoom state for PanResponder coordinate transformation
            zoomStateRef.current = {
              scale: position.scale,
              positionX: position.positionX,
              positionY: position.positionY,
            };
          }}
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
                  detectedHolds={detectedHolds}
                  width={displayedDimensions.width}
                  height={displayedDimensions.height}
                  pointerEvents="none"
                  resizingHoldIndex={resizingHoldIndex}
                  showLabels={showLabels}
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

        {/* Edit controls (shown when editing a hold) */}
        {editable && resizingHoldIndex !== null && (
          <View style={styles.editControls}>
            {/* Top row: Movement and Size controls */}
            <View style={styles.controlsRow}>
              {/* Movement controls */}
              <View style={styles.movementGrid}>
                {/* Up button */}
                <View style={styles.movementRow}>
                  <TouchableOpacity
                    style={styles.moveButton}
                    onPress={() => {
                      const hold = holds[resizingHoldIndex];
                      const deltaY = -0.25;
                      const newHoldY = Math.max(0, hold.holdY + deltaY);
                      const newLabelY = Math.max(0, hold.labelY + deltaY);
                      const updatedHolds = holds.map((h, i) =>
                        i === resizingHoldIndex ? { ...h, holdY: newHoldY, labelY: newLabelY } : h
                      );
                      setHolds(updatedHolds);
                    }}
                  >
                    <Text style={styles.moveButtonText}>▲</Text>
                  </TouchableOpacity>
                </View>
                {/* Left, Down, Right buttons */}
                <View style={styles.movementRow}>
                  <TouchableOpacity
                    style={styles.moveButton}
                    onPress={() => {
                      const hold = holds[resizingHoldIndex];
                      const deltaX = -0.25;
                      const newHoldX = Math.max(0, hold.holdX + deltaX);
                      const newLabelX = Math.max(0, hold.labelX + deltaX);
                      const updatedHolds = holds.map((h, i) =>
                        i === resizingHoldIndex ? { ...h, holdX: newHoldX, labelX: newLabelX } : h
                      );
                      setHolds(updatedHolds);
                    }}
                  >
                    <Text style={styles.moveButtonText}>◄</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.moveButton}
                    onPress={() => {
                      const hold = holds[resizingHoldIndex];
                      const deltaY = 0.25;
                      const newHoldY = Math.min(100, hold.holdY + deltaY);
                      const newLabelY = Math.min(100, hold.labelY + deltaY);
                      const updatedHolds = holds.map((h, i) =>
                        i === resizingHoldIndex ? { ...h, holdY: newHoldY, labelY: newLabelY } : h
                      );
                      setHolds(updatedHolds);
                    }}
                  >
                    <Text style={styles.moveButtonText}>▼</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.moveButton}
                    onPress={() => {
                      const hold = holds[resizingHoldIndex];
                      const deltaX = 0.25;
                      const newHoldX = Math.min(100, hold.holdX + deltaX);
                      const newLabelX = Math.min(100, hold.labelX + deltaX);
                      const updatedHolds = holds.map((h, i) =>
                        i === resizingHoldIndex ? { ...h, holdX: newHoldX, labelX: newLabelX } : h
                      );
                      setHolds(updatedHolds);
                    }}
                  >
                    <Text style={styles.moveButtonText}>►</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Size controls */}
              <View style={styles.sizeControls}>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => {
                    const hold = holds[resizingHoldIndex];
                    const newRadius = Math.max(0.1, hold.radius - 0.1);
                    const updatedHolds = holds.map((h, i) =>
                      i === resizingHoldIndex ? { ...h, radius: newRadius } : h
                    );
                    setHolds(updatedHolds);
                  }}
                >
                  <Text style={styles.adjustButtonText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.sizeValue}>
                  {holds[resizingHoldIndex]?.radius.toFixed(1)}
                </Text>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => {
                    const hold = holds[resizingHoldIndex];
                    const newRadius = Math.min(10, hold.radius + 0.1);
                    const updatedHolds = holds.map((h, i) =>
                      i === resizingHoldIndex ? { ...h, radius: newRadius } : h
                    );
                    setHolds(updatedHolds);
                  }}
                >
                  <Text style={styles.adjustButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Bottom row: Action buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleOpenNoteModal}
              >
                <Text style={styles.actionButtonText}>📝 Note</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={handleDeleteHold}
              >
                <Text style={styles.actionButtonText}>🗑️ Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.doneButton]}
                onPress={() => setResizingHoldIndex(null)}
              >
                <Text style={styles.actionButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

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
  editControls: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  movementGrid: {
    alignItems: 'center',
  },
  movementRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 2,
  },
  moveButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  adjustButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  sizeValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  doneButton: {
    backgroundColor: '#28a745',
  },
});
