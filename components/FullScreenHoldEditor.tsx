import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { getImageDimensions } from '../lib/cache/image-cache';
import { useTranslation } from 'react-i18next';
import { HandHold, DetectedHold } from '../types/database.types';
import { detectedHoldsApi, routesApi } from '../lib/api';
import FullScreenImageBase, { ImageDimensions } from './FullScreenImageBase';
import HoldEditModal from './HoldEditModal';
import FocusedHoldView from './FocusedHoldView';
import { findSmallestPolygonAtPoint } from '../utils/polygon';
import { extractOutlineFromBrushStrokes } from '../utils/polygon-processing';
import { clampFocusRegion, applyMoveDelta, focusCoordsToImageCoords, calculateCentroid } from '../utils/focus-region';
import type { FocusRegion } from '../utils/focus-region';
import { useDragDelta } from '../hooks/useDragDelta';

const ZOOM_MIN = 10;   // 10x magnification, tightest crop
const ZOOM_MAX = 60;   // ~1.7x magnification, widest view
const ZOOM_STEP = 5;
const ZOOM_DEFAULT = 15;

interface FullScreenHoldEditorProps {
  visible: boolean;
  photoUrl: string;
  holds: HandHold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  photoId: string;
  onDeleteDetectedHold?: (holdId: string) => void;
  onUpdateDetectedHold?: (holdId: string, updates: Partial<DetectedHold>) => void;
  onAddDetectedHold?: (hold: DetectedHold) => void;
}

type FocusMode = 'none' | 'selecting' | 'focused';

export default function FullScreenHoldEditor({
  visible,
  photoUrl,
  holds,
  detectedHolds,
  onClose,
  photoId,
  onDeleteDetectedHold,
  onUpdateDetectedHold,
  onAddDetectedHold,
}: FullScreenHoldEditorProps) {
  const { t } = useTranslation();
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [routesUsingHold, setRoutesUsingHold] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Focus mode state
  const [focusMode, setFocusMode] = useState<FocusMode>('none');
  const [focusRegion, setFocusRegion] = useState<FocusRegion | null>(null);
  const [zoomSize, setZoomSize] = useState(ZOOM_DEFAULT);

  // Image dimensions for coordinate conversion
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>({ width: 0, height: 0 });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  // Moving mode state
  const [movingHoldId, setMovingHoldId] = useState<string | null>(null);
  const [isSavingMove, setIsSavingMove] = useState(false);
  const focusRegionRef = useRef<FocusRegion | null>(null);
  const focusedViewDimensionsRef = useRef({ width: 0, height: 0 });

  // Redraw mode state
  const [redrawHoldId, setRedrawHoldId] = useState<string | null>(null);
  const [brushStrokes, setBrushStrokes] = useState<Array<{ x: number; y: number }>>([]);
  const [isSavingRedraw, setIsSavingRedraw] = useState(false);
  const brushRadius = 4; // percentage of focused view width
  const brushStrokesRef = useRef<Array<{ x: number; y: number }>>([]);
  const focusedViewOffsetRef = useRef({ x: 0, y: 0 });

  // Add hold mode state
  const [isAddingHold, setIsAddingHold] = useState(false);

  // Keep refs in sync with state
  React.useEffect(() => {
    focusRegionRef.current = focusRegion;
  }, [focusRegion]);

  React.useEffect(() => {
    brushStrokesRef.current = brushStrokes;
  }, [brushStrokes]);

  // Custom delta calculation for focused view
  const calculateMoveDelta = useCallback((gestureState: { dx: number; dy: number }) => {
    const focus = focusRegionRef.current;
    const dims = focusedViewDimensionsRef.current;
    const sensitivity = 0.4;

    if (!focus || dims.width === 0) return null;

    // Convert from focused view pixels to original image percentage
    const deltaXPercent = (gestureState.dx / dims.width) * focus.width * sensitivity;
    const deltaYPercent = (gestureState.dy / dims.height) * focus.height * sensitivity;

    return { x: deltaXPercent, y: deltaYPercent };
  }, []);

  // Drag hook for moving holds
  const holdDrag = useDragDelta({
    getDimensions: useCallback(() => focusedViewDimensionsRef.current, []),
    calculateDelta: calculateMoveDelta,
  });

  // PanResponder for redraw brush - only works in focused view
  // Uses refs to avoid stale closure issues
  const redrawPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        addBrushPointFromRef(locationX, locationY);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        addBrushPointFromRef(locationX, locationY);
      },
      onPanResponderRelease: () => {
        // Keep strokes - user will explicitly save or cancel
      },
    })
  ).current;

  // Add brush point using refs (called from PanResponder)
  const addBrushPointFromRef = (localX: number, localY: number) => {
    const dims = focusedViewDimensionsRef.current;
    if (dims.width === 0) return;

    const xPercent = (localX / dims.width) * 100;
    const yPercent = (localY / dims.height) * 100;

    if (xPercent >= 0 && xPercent <= 100 && yPercent >= 0 && yPercent <= 100) {
      const newStrokes = [...brushStrokesRef.current, { x: xPercent, y: yPercent }];
      brushStrokesRef.current = newStrokes;
      setBrushStrokes(newStrokes);
    }
  };

  // Move hold handlers
  const startMoveHold = () => {
    setMovingHoldId(selectedHoldId);
    holdDrag.start();
    setDeleteModalVisible(false);
  };

  const cancelMove = () => {
    setMovingHoldId(null);
    holdDrag.cancel();
  };

  const saveMove = async () => {
    const delta = holdDrag.complete();

    if (!movingHoldId || (delta.x === 0 && delta.y === 0)) {
      setMovingHoldId(null);
      return;
    }

    const holdToMove = detectedHolds.find(h => h.id === movingHoldId);
    if (!holdToMove) {
      setMovingHoldId(null);
      return;
    }

    setIsSavingMove(true);

    const moved = applyMoveDelta(holdToMove, delta);

    try {
      await detectedHoldsApi.update(movingHoldId, { polygon: moved.polygon, center: moved.center });
    } catch (err) {
      setIsSavingMove(false);
      Alert.alert(t('common.error'), t('editor.errorMoveHold') + ': ' + (err instanceof Error ? err.message : String(err)));
      return;
    }

    setIsSavingMove(false);

    if (onUpdateDetectedHold) {
      onUpdateDetectedHold(movingHoldId, { polygon: moved.polygon, center: moved.center });
    }

    setMovingHoldId(null);
    setSelectedHoldId(null);
  };

  // Redraw hold handlers
  const startRedraw = () => {
    setRedrawHoldId(selectedHoldId);
    setBrushStrokes([]);
    setDeleteModalVisible(false);
  };

  const cancelRedraw = () => {
    setRedrawHoldId(null);
    setBrushStrokes([]);
  };

  const saveRedraw = async () => {
    if (!redrawHoldId || brushStrokes.length < 3) {
      Alert.alert(t('common.error'), t('editor.errorDrawMore'));
      return;
    }

    const holdToRedraw = detectedHolds.find(h => h.id === redrawHoldId);
    if (!holdToRedraw || !focusRegion) {
      cancelRedraw();
      return;
    }

    setIsSavingRedraw(true);

    // Convert brush strokes to a polygon and map to image coordinates
    const newPolygonInFocusCoords = extractOutlineFromBrushStrokes(brushStrokes, brushRadius);
    const newPolygon = focusCoordsToImageCoords(newPolygonInFocusCoords, focusRegion);
    const newCenter = calculateCentroid(newPolygon);

    try {
      await detectedHoldsApi.update(redrawHoldId, { polygon: newPolygon, center: newCenter });
    } catch (err) {
      setIsSavingRedraw(false);
      Alert.alert(t('common.error'), t('editor.errorRedrawHold') + ': ' + (err instanceof Error ? err.message : String(err)));
      return;
    }

    setIsSavingRedraw(false);

    if (onUpdateDetectedHold) {
      onUpdateDetectedHold(redrawHoldId, { polygon: newPolygon, center: newCenter });
    }

    setRedrawHoldId(null);
    setBrushStrokes([]);
    setSelectedHoldId(null);
  };

  // Add hold handlers
  const startAddHold = () => {
    setIsAddingHold(true);
    setBrushStrokes([]);
    setSelectedHoldId(null);
  };

  const cancelAddHold = () => {
    setIsAddingHold(false);
    setBrushStrokes([]);
  };

  const saveAddHold = async () => {
    if (brushStrokes.length < 3) {
      Alert.alert(t('common.error'), t('editor.errorDrawMore'));
      return;
    }

    if (!focusRegion) {
      cancelAddHold();
      return;
    }

    setIsSavingRedraw(true);

    // Convert brush strokes to a polygon and map to image coordinates
    const newPolygonInFocusCoords = extractOutlineFromBrushStrokes(brushStrokes, brushRadius);
    const newPolygon = focusCoordsToImageCoords(newPolygonInFocusCoords, focusRegion);
    const newCenter = calculateCentroid(newPolygon);

    let newHold: DetectedHold;
    try {
      newHold = await detectedHoldsApi.create({
        photo_id: photoId,
        polygon: newPolygon,
        center: newCenter,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setIsSavingRedraw(false);
      Alert.alert(t('common.error'), t('editor.errorAddHold') + ': ' + (err instanceof Error ? err.message : String(err)));
      return;
    }

    setIsSavingRedraw(false);

    if (onAddDetectedHold) {
      onAddDetectedHold(newHold);
    }

    setIsAddingHold(false);
    setBrushStrokes([]);
  };

  // Get detected holds with moving delta applied
  const getDisplayedDetectedHolds = () => {
    if (!movingHoldId) return detectedHolds;
    return detectedHolds.map(hold => {
      if (hold.id !== movingHoldId) return hold;
      return applyMoveDelta(hold, holdDrag.delta);
    });
  };

  // Handle tap on image - select hold on tap, deselect if tapping elsewhere
  const handleImageTap = (event: any) => {
    if (imageDimensions.width === 0) return;

    const { locationX, locationY } = event;

    const imageX = locationX - imageOffset.x;
    const imageY = locationY - imageOffset.y;

    if (imageX < 0 || imageX > imageDimensions.width ||
        imageY < 0 || imageY > imageDimensions.height) {
      setSelectedHoldId(null);
      return;
    }

    const xPercent = (imageX / imageDimensions.width) * 100;
    const yPercent = (imageY / imageDimensions.height) * 100;

    const tappedHold = findSmallestPolygonAtPoint(xPercent, yPercent, detectedHolds);
    if (tappedHold) {
      setSelectedHoldId(tappedHold.id === selectedHoldId ? null : tappedHold.id);
    } else {
      setSelectedHoldId(null);
    }
  };

  const handleEditSelected = () => {
    if (selectedHoldId) {
      setDeleteModalVisible(true);
    }
  };

  const handleDeleteHold = () => {
    setConfirmingDelete(true);
  };

  const confirmDelete = () => {
    if (selectedHoldId === null) return;

    const selectedHold = detectedHolds.find(h => h.id === selectedHoldId);
    if (!selectedHold) return;

    performDeleteHold(selectedHold);
  };

  const performDeleteHold = async (selectedHold: DetectedHold) => {
    setIsDeleting(true);

    try {
      const routes = await routesApi.listByPhoto(photoId);

      const usingRoutes: string[] = [];
      for (const r of routes) {
        const routeHolds = r.holds;
        const usedInHands = routeHolds.hand_holds.some(h => h.detected_hold_id === selectedHold.id);
        const usedInFeet = routeHolds.foot_holds.some(h => h.detected_hold_id === selectedHold.id);
        if (usedInHands || usedInFeet) {
          usingRoutes.push(r.title);
        }
      }

      if (usingRoutes.length > 0) {
        setIsDeleting(false);
        setConfirmingDelete(false);
        setRoutesUsingHold(usingRoutes);
        return;
      }

      await detectedHoldsApi.delete(selectedHold.id);
    } catch (err) {
      setIsDeleting(false);
      Alert.alert(t('common.error'), err instanceof Error ? err.message : String(err));
      return;
    }

    setIsDeleting(false);

    if (onDeleteDetectedHold) {
      onDeleteDetectedHold(selectedHold.id);
    }

    closeModal();
  };

  const closeModal = () => {
    setDeleteModalVisible(false);
    setSelectedHoldId(null);
    setRoutesUsingHold([]);
    setConfirmingDelete(false);
  };

  // Handle dimensions from base component
  const handleDimensionsReady = (dimensions: ImageDimensions, offset: { x: number; y: number }) => {
    setImageDimensions(dimensions);
    setImageOffset(offset);
  };

  // Load natural image size for focused view
  React.useEffect(() => {
    if (visible && photoUrl) {
      getImageDimensions(photoUrl).then(({ width, height }) => {
        setImageNaturalSize({ width, height });
      }).catch(() => {});
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

    const centerX = Math.max(0, Math.min(100, percent.x));
    const centerY = Math.max(0, Math.min(100, percent.y));

    setFocusRegion(clampFocusRegion(centerX, centerY, zoomSize));
    setFocusMode('focused');
  };

  const startFocusSelection = () => {
    setFocusMode('selecting');
  };

  const adjustZoom = (newZoomSize: number) => {
    if (!focusRegion) return;
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoomSize));
    setZoomSize(clamped);

    const currentCenterX = focusRegion.x + focusRegion.width / 2;
    const currentCenterY = focusRegion.y + focusRegion.height / 2;

    setFocusRegion(clampFocusRegion(currentCenterX, currentCenterY, clamped));
  };

  const exitFocusMode = () => {
    setFocusMode('none');
    setFocusRegion(null);
    setZoomSize(ZOOM_DEFAULT);
    focusedViewDimensionsRef.current = { width: 0, height: 0 };
    focusedViewOffsetRef.current = { x: 0, y: 0 };
  };

  const cancelSelection = () => {
    setFocusMode('none');
  };

  // Handle tap in focused view - manual hit testing
  const handleFocusedViewTap = (event: GestureResponderEvent) => {
    if (focusMode !== 'focused' || !focusRegion) return;

    const { locationX, locationY } = event.nativeEvent;
    const dims = focusedViewDimensionsRef.current;
    if (dims.width === 0) return;

    const xPercent = focusRegion.x + (locationX / dims.width) * focusRegion.width;
    const yPercent = focusRegion.y + (locationY / dims.height) * focusRegion.height;

    const tappedHold = findSmallestPolygonAtPoint(xPercent, yPercent, getDisplayedDetectedHolds());
    if (tappedHold) {
      setSelectedHoldId(tappedHold.id === selectedHoldId ? null : tappedHold.id);
    } else {
      setSelectedHoldId(null);
    }
  };

  // Check if we're in focused mode
  const inFocusedMode = focusMode === 'focused' && focusRegion;

  // If in focused mode, render the focused view instead
  if (focusMode === 'focused' && focusRegion) {
    return (
      <>
        <FocusedHoldView
          photoUrl={photoUrl}
          focusRegion={focusRegion}
          imageNaturalSize={imageNaturalSize}
          detectedHolds={getDisplayedDetectedHolds()}
          selectedHoldId={selectedHoldId}
          onTapHold={handleFocusedViewTap}
          onEditSelected={handleEditSelected}
          onExitFocus={exitFocusMode}
          zoomSize={zoomSize}
          zoomMin={ZOOM_MIN}
          zoomMax={ZOOM_MAX}
          zoomStep={ZOOM_STEP}
          onAdjustZoom={adjustZoom}
          movingHoldId={movingHoldId}
          holdDragPanHandlers={holdDrag.panHandlers}
          onCancelMove={cancelMove}
          onSaveMove={saveMove}
          isSavingMove={isSavingMove}
          redrawHoldId={redrawHoldId}
          isAddingHold={isAddingHold}
          brushStrokes={brushStrokes}
          brushRadius={brushRadius}
          redrawPanHandlers={redrawPanResponder.panHandlers}
          onCancelRedraw={cancelRedraw}
          onSaveRedraw={saveRedraw}
          onCancelAddHold={cancelAddHold}
          onSaveAddHold={saveAddHold}
          onStartAddHold={startAddHold}
          isSavingRedraw={isSavingRedraw}
          focusedViewDimensionsRef={focusedViewDimensionsRef}
          focusedViewOffsetRef={focusedViewOffsetRef}
        />
        <HoldEditModal
          visible={deleteModalVisible}
          onClose={closeModal}
          onDelete={handleDeleteHold}
          confirmingDelete={confirmingDelete}
          onConfirmDelete={confirmDelete}
          onCancelConfirmDelete={() => setConfirmingDelete(false)}
          isDeleting={isDeleting}
          routesUsingHold={routesUsingHold}
          inFocusedMode={!!inFocusedMode}
          onMoveHold={startMoveHold}
          onRedrawShape={startRedraw}
        />
      </>
    );
  }

  return (
    <FullScreenImageBase
      visible={visible}
      photoUrl={photoUrl}
      handHolds={holds}
      detectedHolds={detectedHolds}
      onClose={focusMode === 'selecting' ? cancelSelection : onClose}
      showLabels={false}
      closeButtonText={focusMode === 'selecting' ? t('editor.cancel') : '✕'}
      overlayPointerEvents="none"
      onImageTap={focusMode === 'selecting' ? handleSelectingTap : handleImageTap}
      onDimensionsReady={handleDimensionsReady}
      selectedHoldId={selectedHoldId}
    >
      {/* Focus Area button - only show when not in selecting mode and no hold selected */}
      {focusMode === 'none' && !selectedHoldId && (
        <TouchableOpacity style={styles.focusButton} onPress={startFocusSelection}>
          <Text style={styles.focusButtonText}>{t('editor.precisionMode')}</Text>
        </TouchableOpacity>
      )}

      {/* Edit button - show when a hold is selected */}
      {selectedHoldId && focusMode === 'none' && (
        <TouchableOpacity style={styles.editButton} onPress={handleEditSelected}>
          <Text style={styles.editButtonText}>{t('editor.editHold')}</Text>
        </TouchableOpacity>
      )}

      {/* Selection mode helper */}
      {focusMode === 'selecting' && (
        <View style={styles.selectionHelper}>
          <Text style={styles.selectionHelperText}>
            {t('editor.tapToZoom')}
          </Text>
        </View>
      )}

      <HoldEditModal
        visible={deleteModalVisible}
        onClose={closeModal}
        onDelete={handleDeleteHold}
        confirmingDelete={confirmingDelete}
        onConfirmDelete={confirmDelete}
        onCancelConfirmDelete={() => setConfirmingDelete(false)}
        isDeleting={isDeleting}
        routesUsingHold={routesUsingHold}
        inFocusedMode={false}
        onMoveHold={startMoveHold}
        onRedrawShape={startRedraw}
      />
    </FullScreenImageBase>
  );
}

const styles = StyleSheet.create({
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
});
