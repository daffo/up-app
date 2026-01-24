import React, { useState } from 'react';
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
import { findSmallestPolygonAtPoint } from '../utils/polygon';

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
  const [movingMode, setMovingMode] = useState<'label' | null>(null);

  // Image dimensions from base component
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>({ width: 0, height: 0 });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });

  React.useEffect(() => {
    setHolds(initialHolds);
  }, [initialHolds]);

  const handleDimensionsReady = (dimensions: ImageDimensions, offset: { x: number; y: number }) => {
    setImageDimensions(dimensions);
    setImageOffset(offset);
  };

  const handleImageTap = (event: any) => {
    if (imageDimensions.width === 0) return;

    const { locationX, locationY } = event;

    // Convert screen coordinates to image-relative coordinates
    const imageX = locationX - imageOffset.x;
    const imageY = locationY - imageOffset.y;

    // Check if tap is outside the image bounds
    if (imageX < 0 || imageX > imageDimensions.width ||
        imageY < 0 || imageY > imageDimensions.height) {
      return;
    }

    // Convert to percentages relative to displayed image
    const xPercent = (imageX / imageDimensions.width) * 100;
    const yPercent = (imageY / imageDimensions.height) * 100;

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
    <FullScreenImageBase
      visible={visible}
      photoUrl={photoUrl}
      holds={holds}
      detectedHolds={detectedHolds}
      onClose={handleDone}
      showLabels={true}
      headerTitle={`Edit Holds (${holds.length})`}
      headerRight={
        <TouchableOpacity onPress={handleDone} style={styles.doneButton}>
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      }
      helperBanner={movingMode ? (
        <View style={baseStyles.helperBanner}>
          <Text style={baseStyles.helperText}>
            Tap to move label position
          </Text>
        </View>
      ) : undefined}
      overlayPointerEvents="none"
      onImageTap={handleImageTap}
      onDimensionsReady={handleDimensionsReady}
    >
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

            <TouchableOpacity style={baseStyles.modalButton} onPress={handleMoveLabel}>
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
});
