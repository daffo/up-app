import React, { useState, useCallback } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Pressable,
  Text,
  Alert,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Hold, HandHold, FootHold, DetectedHold } from '../types/database.types';
import FullScreenImageBase, { baseStyles, ImageDimensions } from './FullScreenImageBase';
import DragModeButtons from './DragModeButtons';
import { findSmallestPolygonAtPoint } from '../utils/polygon';
import { getHoldLabel, canSetStart, canSetTop, isDualSideNote, findFreeLabelPosition, resolveAllLabelOverlaps } from '../utils/holds';
import { useDragDelta } from '../hooks/useDragDelta';
import { useThemeColors } from '../lib/theme-context';

/** Collect centers of all holds currently in the route. */
function getRouteHoldCenters(
  handHolds: HandHold[],
  footHolds: FootHold[],
  detectedHolds: DetectedHold[],
): Array<{ x: number; y: number }> {
  const byId = new Map(detectedHolds.map(dh => [dh.id, dh.center]));
  const ids = [...handHolds, ...footHolds].map(h => h.detected_hold_id);
  return ids.flatMap(id => { const c = byId.get(id); return c ? [c] : []; });
}

interface FullScreenRouteEditorProps {
  visible: boolean;
  photoUrl: string;
  handHolds: HandHold[];
  footHolds: FootHold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  onUpdateHandHolds: (handHolds: HandHold[]) => void;
  onUpdateFootHolds: (footHolds: FootHold[]) => void;
}

export default function FullScreenRouteEditor({
  visible,
  photoUrl,
  handHolds: initialHandHolds,
  footHolds: initialFootHolds,
  detectedHolds,
  onClose,
  onUpdateHandHolds,
  onUpdateFootHolds,
}: FullScreenRouteEditorProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [handHolds, setHandHolds] = useState<HandHold[]>(initialHandHolds);
  const [footHolds, setFootHolds] = useState<FootHold[]>(initialFootHolds);
  const [editMode, setEditMode] = useState<'hands' | 'feet'>('hands');
  // Selection: which hold is selected and what type
  type HoldRef = { type: 'hand'; index: number } | { type: 'foot'; index: number };
  const [selectedHoldRef, setSelectedHoldRef] = useState<HoldRef | null>(null);
  const [matchingHoldRefs, setMatchingHoldRefs] = useState<HoldRef[]>([]);
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
    setHandHolds(initialHandHolds);
  }, [initialHandHolds]);

  React.useEffect(() => {
    setFootHolds(initialFootHolds);
  }, [initialFootHolds]);

  // Derived selection helpers
  const selectedHandHoldIndex = selectedHoldRef?.type === 'hand' ? selectedHoldRef.index : null;
  const selectedFootHoldIndex = selectedHoldRef?.type === 'foot' ? selectedHoldRef.index : null;

  // Start moving label (works for both hand and foot holds)
  const startMoveLabel = () => {
    if (!selectedHoldRef) return;
    setMovingLabelIndex(selectedHoldRef.index);
    labelDrag.start();
    setEditModalVisible(false);
  };

  // Cancel move
  const cancelMoveLabel = () => {
    setMovingLabelIndex(null);
    labelDrag.cancel();
  };

  // Apply label position delta to a hold list
  const applyLabelDelta = <T extends Hold>(holds: T[], index: number, delta: { x: number; y: number }): T[] =>
    holds.map((hold, i) => i === index ? { ...hold, labelX: hold.labelX + delta.x, labelY: hold.labelY + delta.y, labelPinned: true } : hold);

  // Save move
  const saveMoveLabel = () => {
    if (movingLabelIndex === null || !selectedHoldRef) return;
    const delta = labelDrag.complete();

    if (selectedHoldRef.type === 'foot') {
      setFootHolds(applyLabelDelta(footHolds, movingLabelIndex, delta));
    } else {
      setHandHolds(applyLabelDelta(handHolds, movingLabelIndex, delta));
    }

    setMovingLabelIndex(null);
    clearSelection();
  };

  const handleDimensionsReady = (dimensions: ImageDimensions, offset: { x: number; y: number }) => {
    setImageDimensions(dimensions);
    setImageOffset(offset);
  };

  // Get the selected hold's detected_hold_id for highlighting
  const getSelectedHold = (): Hold | null => {
    if (!selectedHoldRef) return null;
    return selectedHoldRef.type === 'hand'
      ? handHolds[selectedHoldRef.index]
      : footHolds[selectedHoldRef.index];
  };
  const selectedHoldId = getSelectedHold()?.detected_hold_id ?? null;

  const clearSelection = () => {
    setSelectedHoldRef(null);
    setMatchingHoldRefs([]);
  };

  const addHoldToRoute = (detectedHoldId: string, labelCenterX: number, labelCenterY: number) => {
    // Place new hold at its ideal (closest) position — don't dodge existing labels
    const allRouteCenters = getRouteHoldCenters(handHolds, footHolds, detectedHolds);
    const { labelX, labelY } = findFreeLabelPosition(labelCenterX, labelCenterY, [], allRouteCenters);

    // Settle new hold first, then reflow existing labels around it
    const newHoldCenter = detectedHolds.find(dh => dh.id === detectedHoldId)?.center ?? { x: labelCenterX, y: labelCenterY };
    const newLabel = { detected_hold_id: detectedHoldId, labelX, labelY };
    const allCenters = [newHoldCenter, ...allRouteCenters];
    const allHolds = [newLabel, ...handHolds, ...footHolds];
    const resolved = resolveAllLabelOverlaps(allHolds, allCenters);

    const resolvedNew = resolved[0];
    const resolvedHands = resolved.slice(1, 1 + handHolds.length) as HandHold[];
    const resolvedFeet = resolved.slice(1 + handHolds.length) as FootHold[];

    if (editMode === 'feet') {
      setHandHolds(resolvedHands);
      setFootHolds([...resolvedFeet, { ...resolvedNew } as FootHold]);
    } else {
      setHandHolds([...resolvedHands, { order: handHolds.length + 1, ...resolvedNew, note: '' } as HandHold]);
      setFootHolds(resolvedFeet);
    }
  };

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
      clearSelection();
      return;
    }

    // Convert to percentages relative to displayed image
    const xPercent = (imageX / imageDimensions.width) * 100;
    const yPercent = (imageY / imageDimensions.height) * 100;

    // Build polygon lookup for a hold list
    const buildPolygonLookup = (holds: Hold[]) =>
      holds
        .map((hold, index) => {
          const dh = detectedHolds.find(d => d.id === hold.detected_hold_id);
          return dh ? { index, polygon: dh.polygon } : null;
        })
        .filter((h): h is { index: number; polygon: Array<{ x: number; y: number }> } => h !== null);

    const handHoldsWithPolygons = buildPolygonLookup(handHolds);
    const footHoldsWithPolygons = buildPolygonLookup(footHolds);

    // Find the smallest polygon at tap point across both hand and foot holds
    const smallestHandHold = findSmallestPolygonAtPoint(xPercent, yPercent, handHoldsWithPolygons);
    const smallestFootHold = findSmallestPolygonAtPoint(xPercent, yPercent, footHoldsWithPolygons);

    if (smallestHandHold || smallestFootHold) {
      // Determine the tapped detected_hold_id (prefer smallest polygon overall)
      const tappedDetectedId = smallestHandHold
        ? handHolds[smallestHandHold.index].detected_hold_id
        : footHolds[smallestFootHold!.index].detected_hold_id;

      // Find ALL holds (hand + foot) using the same detected_hold_id
      const allMatching: HoldRef[] = [
        ...handHolds
          .map((h, i) => ({ type: 'hand' as const, index: i }))
          .filter((_, i) => handHolds[i].detected_hold_id === tappedDetectedId),
        ...footHolds
          .map((h, i) => ({ type: 'foot' as const, index: i }))
          .filter((_, i) => footHolds[i].detected_hold_id === tappedDetectedId),
      ];

      // Toggle selection if already selected
      if (selectedHoldRef && allMatching.some(r => r.type === selectedHoldRef.type && r.index === selectedHoldRef.index)) {
        clearSelection();
      } else if (allMatching.length === 1) {
        clearSelection();
        setSelectedHoldRef(allMatching[0]);
      } else {
        // Multiple holds on the same detected hold — select first and store all for picker
        clearSelection();
        setSelectedHoldRef(allMatching[0]);
        setMatchingHoldRefs(allMatching);
      }
      return;
    }

    // Deselect if we have a selection and tapped elsewhere
    if (selectedHoldRef) {
      clearSelection();
      return;
    }

    // Check if tapped on any detected hold to add to route (prioritize smallest)
    const smallestDetectedHold = findSmallestPolygonAtPoint(xPercent, yPercent, detectedHolds);
    if (smallestDetectedHold) {
      addHoldToRoute(smallestDetectedHold.id, xPercent, yPercent);
      return;
    }

    // No hold detected at tap location
    Alert.alert(t('editor.noHold'), t('editor.noHoldMessage'));
  };

  const handleEditSelected = () => {
    if (!selectedHoldRef) return;

    // If multiple holds share the same detected hold, show picker
    if (matchingHoldRefs.length > 1) {
      setHoldPickerVisible(true);
    } else {
      setEditModalVisible(true);
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedHoldRef) return;
    if (selectedHoldRef.type === 'foot') {
      setFootHolds(footHolds.filter((_, i) => i !== selectedHoldRef.index));
    } else {
      const filtered = handHolds.filter((_, i) => i !== selectedHoldRef.index);
      setHandHolds(filtered.map((hold, i) => ({ ...hold, order: i + 1 })));
    }
    setEditModalVisible(false);
    clearSelection();
  };

  // Open note modal for the currently selected hold (hand or foot)
  const handleOpenNoteModal = () => {
    const hold = getSelectedHold();
    if (!hold) return;
    setNoteText(hold.note || '');
    setNoteModalVisible(true);
    setEditModalVisible(false);
  };

  const handlePickHoldToEdit = (ref: HoldRef) => {
    setSelectedHoldRef(ref);
    setHoldPickerVisible(false);
    setEditModalVisible(true);
  };

  // Add Again — respects editMode, works for any selected hold type
  const handleAddAgain = () => {
    const selectedHold = selectedHandHoldIndex !== null
      ? handHolds[selectedHandHoldIndex]
      : selectedFootHoldIndex !== null
        ? footHolds[selectedFootHoldIndex]
        : null;
    if (!selectedHold) return;

    const detectedHold = detectedHolds.find(dh => dh.id === selectedHold.detected_hold_id);
    if (!detectedHold) return;

    const centerX = detectedHold.polygon.reduce((sum, p) => sum + p.x, 0) / detectedHold.polygon.length;
    const centerY = detectedHold.polygon.reduce((sum, p) => sum + p.y, 0) / detectedHold.polygon.length;

    addHoldToRoute(selectedHold.detected_hold_id, centerX, centerY);
    clearSelection();
  };

  const handleSaveNote = () => {
    if (!selectedHoldRef) return;
    if (selectedHoldRef.type === 'foot') {
      setFootHolds(footHolds.map((hold, i) =>
        i === selectedHoldRef.index ? { ...hold, note: noteText } : hold
      ));
    } else {
      setHandHolds(handHolds.map((hold, i) =>
        i === selectedHoldRef.index ? { ...hold, note: noteText } : hold
      ));
    }
    setNoteModalVisible(false);
    clearSelection();
  };

  const handleSetSingleStart = () => {
    if (selectedHandHoldIndex === null) return;
    const otherIndex = selectedHandHoldIndex === 0 ? 1 : 0;
    const updated = handHolds.map((hold, i) => {
      if (i === selectedHandHoldIndex || i === otherIndex) return { ...hold, note: '' };
      return hold;
    });
    setHandHolds(updated);
    setEditModalVisible(false);
    clearSelection();
  };

  const handleSetDualStart = (side: 'DX' | 'SX') => {
    if (selectedHandHoldIndex === null) return;
    const otherSide = side === 'DX' ? 'SX' : 'DX';
    const otherIndex = selectedHandHoldIndex === 0 ? 1 : 0;
    const updated = handHolds.map((hold, i) => {
      if (i === selectedHandHoldIndex) return { ...hold, note: side };
      if (i === otherIndex) return { ...hold, note: otherSide };
      return hold;
    });
    setHandHolds(updated);
    setEditModalVisible(false);
    clearSelection();
  };

  const handleSetSingleTop = () => {
    if (selectedHandHoldIndex === null) return;
    const lastIndex = handHolds.length - 1;
    const secondLastIndex = handHolds.length - 2;
    const updated = handHolds.map((hold, i) => {
      if (i === lastIndex || i === secondLastIndex) return { ...hold, note: '' };
      return hold;
    });
    setHandHolds(updated);
    setEditModalVisible(false);
    clearSelection();
  };

  const handleSetDualTop = (side: 'DX' | 'SX') => {
    if (selectedHandHoldIndex === null) return;
    const otherSide = side === 'DX' ? 'SX' : 'DX';
    const lastIndex = handHolds.length - 1;
    const secondLastIndex = handHolds.length - 2;
    const otherIndex = selectedHandHoldIndex === lastIndex ? secondLastIndex : lastIndex;
    const updated = handHolds.map((hold, i) => {
      if (i === selectedHandHoldIndex) return { ...hold, note: side };
      if (i === otherIndex) return { ...hold, note: otherSide };
      return hold;
    });
    setHandHolds(updated);
    setEditModalVisible(false);
    clearSelection();
  };

  // Get hand holds with moving delta applied for visual feedback
  // Apply live drag delta to the hold being moved (for visual feedback)
  const withLiveDelta = <T extends Hold>(holds: T[], isActive: boolean): T[] => {
    if (movingLabelIndex === null || !isActive) return holds;
    return applyLabelDelta(holds, movingLabelIndex, labelDrag.delta);
  };

  const isMovingLabel = movingLabelIndex !== null;

  const handleDone = () => {
    onUpdateHandHolds(handHolds);
    onUpdateFootHolds(footHolds);
    onClose();
  };

  return (
    <FullScreenImageBase
      visible={visible}
      photoUrl={photoUrl}
      handHolds={withLiveDelta(handHolds, selectedHoldRef?.type !== 'foot')}
      footHolds={withLiveDelta(footHolds, selectedHoldRef?.type === 'foot')}
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
      {/* Mode toggle button — top-right, left of Done */}
      {!isMovingLabel && (
        <TouchableOpacity
          style={styles.modeToggleButton}
          onPress={() => {
            setEditMode(editMode === 'hands' ? 'feet' : 'hands');
            clearSelection();
          }}
        >
          <Text style={styles.modeToggleText}>
            {editMode === 'hands' ? t('editor.handsMode') : t('editor.feetMode')}
          </Text>
        </TouchableOpacity>
      )}

      {/* Action buttons - show when any hold is selected and not moving */}
      {selectedHoldRef && !isMovingLabel && (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleEditSelected}>
            <Text style={styles.actionButtonText}>{t('editor.edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleAddAgain}>
            <Text style={styles.actionButtonText}>{t('editor.addAgain')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Moving mode buttons */}
      {isMovingLabel && (
        <DragModeButtons onCancel={cancelMoveLabel} onSave={saveMoveLabel} />
      )}

      {/* Unified Edit Hold Modal */}
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
          <View style={[baseStyles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[baseStyles.modalTitle, { color: colors.textPrimary }]}>
              {t('editor.editHold')} {selectedHoldRef?.type === 'hand' && selectedHandHoldIndex !== null
                ? getHoldLabel(selectedHandHoldIndex, handHolds.length, handHolds[selectedHandHoldIndex]?.note)
                : selectedHoldRef?.type === 'foot' && selectedFootHoldIndex !== null
                  ? (footHolds[selectedFootHoldIndex]?.note ? `${t('editor.foot')} — ${footHolds[selectedFootHoldIndex].note}` : t('editor.foot'))
                  : ''}
            </Text>

            {/* Hand-hold-only options: Start/Top */}
            {selectedHandHoldIndex !== null && canSetStart(selectedHandHoldIndex, handHolds.length) && (() => {
              const currentNote = handHolds[selectedHandHoldIndex]?.note;
              const isDual = isDualSideNote(currentNote);
              return (
                <>
                  {selectedHandHoldIndex === 0 && isDual && (
                    <TouchableOpacity style={baseStyles.modalButton} onPress={handleSetSingleStart}>
                      <Text style={baseStyles.modalButtonText}>{t('editor.setStart')}</Text>
                    </TouchableOpacity>
                  )}
                  {!currentNote?.startsWith('DX') && (
                    <TouchableOpacity style={baseStyles.modalButton} onPress={() => handleSetDualStart('DX')}>
                      <Text style={baseStyles.modalButtonText}>{t('editor.setStartDX')}</Text>
                    </TouchableOpacity>
                  )}
                  {!currentNote?.startsWith('SX') && (
                    <TouchableOpacity style={baseStyles.modalButton} onPress={() => handleSetDualStart('SX')}>
                      <Text style={baseStyles.modalButtonText}>{t('editor.setStartSX')}</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}

            {selectedHandHoldIndex !== null && canSetTop(selectedHandHoldIndex, handHolds.length) && (() => {
              const currentNote = handHolds[selectedHandHoldIndex]?.note;
              const isDual = isDualSideNote(currentNote);
              return (
                <>
                  {selectedHandHoldIndex === handHolds.length - 1 && isDual && (
                    <TouchableOpacity style={baseStyles.modalButton} onPress={handleSetSingleTop}>
                      <Text style={baseStyles.modalButtonText}>{t('editor.setTop')}</Text>
                    </TouchableOpacity>
                  )}
                  {!currentNote?.startsWith('DX') && (
                    <TouchableOpacity style={baseStyles.modalButton} onPress={() => handleSetDualTop('DX')}>
                      <Text style={baseStyles.modalButtonText}>{t('editor.setTopDX')}</Text>
                    </TouchableOpacity>
                  )}
                  {!currentNote?.startsWith('SX') && (
                    <TouchableOpacity style={baseStyles.modalButton} onPress={() => handleSetDualTop('SX')}>
                      <Text style={baseStyles.modalButtonText}>{t('editor.setTopSX')}</Text>
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}

            {/* Common options: Edit Note, Move Label, Delete */}
            <TouchableOpacity style={baseStyles.modalButton} onPress={handleOpenNoteModal}>
              <Text style={baseStyles.modalButtonText}>{t('editor.editNote')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={baseStyles.modalButton} onPress={startMoveLabel}>
              <Text style={baseStyles.modalButtonText}>{t('editor.moveLabelPosition')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonDanger]}
              onPress={handleDeleteSelected}
            >
              <Text style={baseStyles.modalButtonText}>{t('editor.deleteHold')}</Text>
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
          <Pressable style={[baseStyles.modalContent, { backgroundColor: colors.cardBackground }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[baseStyles.modalTitle, { color: colors.textPrimary }]}>{t('editor.addNote')}</Text>
            <TextInput
              style={[baseStyles.noteInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }]}
              value={noteText}
              onChangeText={setNoteText}
              placeholder={t('editor.enterNote')}
              placeholderTextColor={colors.placeholderText}
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
          </Pressable>
        </TouchableOpacity>
      </Modal>

      {/* Hold Picker Modal - when multiple holds share the same detected hold */}
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
          <View style={[baseStyles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[baseStyles.modalTitle, { color: colors.textPrimary }]}>{t('editor.whichHoldToEdit')}</Text>
            {matchingHoldRefs.map((ref, i) => (
              <TouchableOpacity
                key={`${ref.type}-${ref.index}`}
                style={baseStyles.modalButton}
                onPress={() => handlePickHoldToEdit(ref)}
              >
                <Text style={baseStyles.modalButtonText}>
                  {ref.type === 'hand'
                    ? `${t('editor.hold')} ${getHoldLabel(ref.index, handHolds.length, handHolds[ref.index]?.note)}`
                    : (footHolds[ref.index]?.note ? `${t('editor.foot')} — ${footHolds[ref.index].note}` : t('editor.foot'))}
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
  modeToggleButton: {
    position: 'absolute',
    top: 50,
    right: 90,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeToggleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
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
