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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [holds, setHolds] = useState<Hold[]>(initialHolds);
  const [selectedHoldIndex, setSelectedHoldIndex] = useState<number | null>(null);
  const [matchingHoldIndices, setMatchingHoldIndices] = useState<number[]>([]);
  const [holdPickerVisible, setHoldPickerVisible] = useState(false);
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
    setMatchingHoldIndices([]);
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
      setSelectedHoldIndex(null);
      setMatchingHoldIndices([]);
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
      const tappedHold = holds[smallestRouteHold.index];
      // Find all route holds that use the same detected_hold_id
      const allMatching = holds
        .map((h, i) => ({ index: i, hold: h }))
        .filter(({ hold }) => hold.detected_hold_id === tappedHold.detected_hold_id)
        .map(({ index }) => index);

      // Toggle selection
      if (selectedHoldIndex !== null && allMatching.includes(selectedHoldIndex)) {
        setSelectedHoldIndex(null);
        setMatchingHoldIndices([]);
      } else {
        setSelectedHoldIndex(smallestRouteHold.index);
        setMatchingHoldIndices(allMatching);
      }
      return;
    }

    // Deselect if we have a selection and tapped elsewhere
    if (selectedHoldIndex !== null) {
      setSelectedHoldIndex(null);
      setMatchingHoldIndices([]);
      return;
    }

    // Check if tapped on any detected hold to add to route (prioritize smallest)
    const smallestDetectedHold = findSmallestPolygonAtPoint(xPercent, yPercent, detectedHolds);
    if (smallestDetectedHold) {
      // Check if this hold is already in the route
      const alreadyUsed = holds.some(h => h.detected_hold_id === smallestDetectedHold.id);
      if (alreadyUsed) {
        Alert.alert(t('editor.holdAlreadyUsed'), t('editor.holdAlreadyUsedMessage'));
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
    Alert.alert(t('editor.noHold'), t('editor.noHoldMessage'));
  };

  const handleEditSelected = () => {
    if (selectedHoldIndex === null) return;

    // If multiple holds use the same detected_hold_id, show picker
    if (matchingHoldIndices.length > 1) {
      setHoldPickerVisible(true);
    } else {
      setEditModalVisible(true);
    }
  };

  const handlePickHoldToEdit = (index: number) => {
    setSelectedHoldIndex(index);
    setHoldPickerVisible(false);
    setEditModalVisible(true);
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
    setMatchingHoldIndices([]);
  };

  const handleDuplicateHold = () => {
    if (selectedHoldIndex === null) return;

    const selectedHold = holds[selectedHoldIndex];
    const detectedHold = detectedHolds.find(dh => dh.id === selectedHold.detected_hold_id);
    if (!detectedHold) return;

    // Calculate center of the hold for label positioning
    const centerX = detectedHold.polygon.reduce((sum, p) => sum + p.x, 0) / detectedHold.polygon.length;
    const centerY = detectedHold.polygon.reduce((sum, p) => sum + p.y, 0) / detectedHold.polygon.length;

    const newHold: Hold = {
      order: holds.length + 1,
      detected_hold_id: selectedHold.detected_hold_id,
      labelX: centerX + 3,
      labelY: centerY - 3,
      note: '',
    };

    setHolds([...holds, newHold]);
    setSelectedHoldIndex(null);
    setMatchingHoldIndices([]);
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
    setMatchingHoldIndices([]);
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
      closeButtonText={isMovingLabel ? t('editor.cancel') : t('editor.done')}
      helperBanner={isMovingLabel ? (
        <View style={baseStyles.helperBanner}>
          <Text style={baseStyles.helperText}>
            {t('editor.dragToMoveLabel')}
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
      {/* Action buttons - show when a hold is selected and not moving */}
      {selectedHoldIndex !== null && !isMovingLabel && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleEditSelected}>
            <Text style={styles.actionButtonText}>{t('editor.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleDuplicateHold}>
            <Text style={styles.actionButtonText}>{t('editor.addAgain')}</Text>
          </TouchableOpacity>
        </View>
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
              {t('editor.editHold')} {selectedHoldIndex !== null ? holds[selectedHoldIndex]?.order : ''}
            </Text>

            <TouchableOpacity style={baseStyles.modalButton} onPress={handleOpenNoteModal}>
              <Text style={baseStyles.modalButtonText}>{t('editor.editNote')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={baseStyles.modalButton} onPress={startMoveLabel}>
              <Text style={baseStyles.modalButtonText}>{t('editor.moveLabelPosition')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonDanger]}
              onPress={handleDeleteHold}
            >
              <Text style={baseStyles.modalButtonText}>
                {t('editor.deleteHold')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
              onPress={() => setEditModalVisible(false)}
            >
              <Text style={baseStyles.modalButtonText}>{t('editor.cancel')}</Text>
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
            <Text style={baseStyles.modalTitle}>{t('editor.addNote')}</Text>
            <TextInput
              style={baseStyles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder={t('editor.enterNote')}
              multiline
              autoFocus
            />
            <TouchableOpacity style={baseStyles.modalButton} onPress={handleSaveNote}>
              <Text style={baseStyles.modalButtonText}>{t('common.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
              onPress={() => setNoteModalVisible(false)}
            >
              <Text style={baseStyles.modalButtonText}>{t('editor.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Hold Picker Modal - when multiple holds use the same detected hold */}
      <Modal
        visible={holdPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHoldPickerVisible(false)}
      >
        <TouchableOpacity
          style={baseStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setHoldPickerVisible(false)}
        >
          <View style={baseStyles.modalContent}>
            <Text style={baseStyles.modalTitle}>{t('editor.whichHoldToEdit')}</Text>
            {matchingHoldIndices.map((index) => (
              <TouchableOpacity
                key={index}
                style={baseStyles.modalButton}
                onPress={() => handlePickHoldToEdit(index)}
              >
                <Text style={baseStyles.modalButtonText}>
                  {t('editor.hold')} {holds[index]?.order}{holds[index]?.note ? ` - ${holds[index].note}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
              onPress={() => setHoldPickerVisible(false)}
            >
              <Text style={baseStyles.modalButtonText}>{t('editor.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </FullScreenImageBase>
  );
}

const styles = StyleSheet.create({
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(0, 102, 204, 0.95)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: 'rgba(40, 167, 69, 0.95)',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
