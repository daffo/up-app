import React, { useState, useCallback } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  Alert,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Hold, DetectedHold } from '../types/database.types';
import FullScreenImageBase, { baseStyles, ImageDimensions } from './FullScreenImageBase';
import DragModeButtons from './DragModeButtons';
import { findSmallestPolygonAtPoint } from '../utils/polygon';
import { useDragDelta } from '../hooks/useDragDelta';

interface FullScreenRouteEditorProps {
  visible: boolean;
  photoUrl: string;
  holds: Hold[];
  detectedHolds: DetectedHold[];
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
  const [selectedHoldIndex, setSelectedHoldIndex] = useState<number | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState('');

  // Moving label state
  const [movingLabelIndex, setMovingLabelIndex] = useState<number | null>(null);

  // Image dimensions from base component
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>({ width: 0, height: 0 });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });

  // Drag hook for moving labels
  const getDimensions = useCallback(() => imageDimensions, [imageDimensions]);
  const labelDrag = useDragDelta({ getDimensions });

  React.useEffect(() => {
    setHolds(initialHolds);
  }, [initialHolds]);

  // Start moving label
  const startMoveLabel = () => {
    setMovingLabelIndex(selectedHoldIndex);
    labelDrag.start();
    setEditModalVisible(false);
  };

  // Cancel move
  const cancelMoveLabel = () => {
    setMovingLabelIndex(null);
    labelDrag.cancel();
  };

  // Save move
  const saveMoveLabel = () => {
    if (movingLabelIndex === null) return;

    const delta = labelDrag.complete();
    const updatedHolds = holds.map((hold, i) => {
      if (i === movingLabelIndex) {
        return {
          ...hold,
          labelX: hold.labelX + delta.x,
          labelY: hold.labelY + delta.y,
        };
      }
      return hold;
    });

    setHolds(updatedHolds);
    setMovingLabelIndex(null);
    setSelectedHoldIndex(null);
  };

  const handleDimensionsReady = (dimensions: ImageDimensions, offset: { x: number; y: number }) => {
    setImageDimensions(dimensions);
    setImageOffset(offset);
  };

  // Get the selected hold's detected_hold_id for highlighting
  const selectedHoldId = selectedHoldIndex !== null ? holds[selectedHoldIndex]?.detected_hold_id : null;

  const handleImageTap = (event: any) => {
    // Ignore taps when in moving mode (handled by PanResponder)
    if (movingLabelIndex !== null) return;

    if (imageDimensions.width === 0) return;

    const { locationX, locationY } = event;

    // Convert screen coordinates to image-relative coordinates
    const imageX = locationX - imageOffset.x;
    const imageY = locationY - imageOffset.y;

    // Check if tap is outside the image bounds
    if (imageX < 0 || imageX > imageDimensions.width ||
        imageY < 0 || imageY > imageDimensions.height) {
      setSelectedHoldIndex(null); // Deselect on tap outside
      return;
    }

    // Convert to percentages relative to displayed image
    const xPercent = (imageX / imageDimensions.width) * 100;
    const yPercent = (imageY / imageDimensions.height) * 100;

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
      // Toggle selection (or select if different hold)
      setSelectedHoldIndex(smallestRouteHold.index === selectedHoldIndex ? null : smallestRouteHold.index);
      return;
    }

    // Deselect if we have a selection and tapped elsewhere
    if (selectedHoldIndex !== null) {
      setSelectedHoldIndex(null);
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

  const handleEditSelected = () => {
    if (selectedHoldIndex !== null) {
      setEditModalVisible(true);
    }
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

  // Get holds with moving delta applied for visual feedback
  const getDisplayedHolds = () => {
    if (movingLabelIndex === null) return holds;
    return holds.map((hold, i) => {
      if (i === movingLabelIndex) {
        return {
          ...hold,
          labelX: hold.labelX + labelDrag.delta.x,
          labelY: hold.labelY + labelDrag.delta.y,
        };
      }
      return hold;
    });
  };

  const isMovingLabel = movingLabelIndex !== null;

  const handleDone = () => {
    onUpdateHolds(holds);
    onClose();
  };

  return (
    <FullScreenImageBase
      visible={visible}
      photoUrl={photoUrl}
      holds={getDisplayedHolds()}
      detectedHolds={detectedHolds}
      onClose={isMovingLabel ? cancelMoveLabel : handleDone}
      showLabels={true}
      closeButtonText={isMovingLabel ? 'Cancel' : 'Done'}
      helperBanner={isMovingLabel ? (
        <View style={baseStyles.helperBanner}>
          <Text style={baseStyles.helperText}>
            Drag to move label position
          </Text>
        </View>
      ) : undefined}
      overlayPointerEvents="none"
      onImageTap={handleImageTap}
      onDimensionsReady={handleDimensionsReady}
      selectedHoldId={selectedHoldId}
      panHandlers={isMovingLabel ? labelDrag.panHandlers : undefined}
      lockZoom={isMovingLabel}
    >
      {/* Edit button - show when a hold is selected and not moving */}
      {selectedHoldIndex !== null && !isMovingLabel && (
        <TouchableOpacity style={styles.editButton} onPress={handleEditSelected}>
          <Text style={styles.editButtonText}>Edit Hold {holds[selectedHoldIndex]?.order}</Text>
        </TouchableOpacity>
      )}

      {/* Moving mode buttons */}
      {isMovingLabel && (
        <DragModeButtons onCancel={cancelMoveLabel} onSave={saveMoveLabel} />
      )}

      {/* Edit Hold Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableOpacity
          style={baseStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditModalVisible(false)}
        >
          <View style={baseStyles.modalContent}>
            <Text style={baseStyles.modalTitle}>
              Edit Hold {selectedHoldIndex !== null ? holds[selectedHoldIndex]?.order : ''}
            </Text>

            <TouchableOpacity style={baseStyles.modalButton} onPress={handleOpenNoteModal}>
              <Text style={baseStyles.modalButtonText}>Edit Note</Text>
            </TouchableOpacity>

            <TouchableOpacity style={baseStyles.modalButton} onPress={startMoveLabel}>
              <Text style={baseStyles.modalButtonText}>Move Label Position</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonDanger]}
              onPress={handleDeleteHold}
            >
              <Text style={baseStyles.modalButtonText}>
                Delete Hold
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
              onPress={() => setEditModalVisible(false)}
            >
              <Text style={baseStyles.modalButtonText}>Cancel</Text>
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
          style={baseStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setNoteModalVisible(false)}
        >
          <View style={baseStyles.modalContent}>
            <Text style={baseStyles.modalTitle}>Add Note</Text>
            <TextInput
              style={baseStyles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Enter note (optional)"
              multiline
              autoFocus
            />
            <TouchableOpacity style={baseStyles.modalButton} onPress={handleSaveNote}>
              <Text style={baseStyles.modalButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
              onPress={() => setNoteModalVisible(false)}
            >
              <Text style={baseStyles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </FullScreenImageBase>
  );
}

const styles = StyleSheet.create({
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
});
