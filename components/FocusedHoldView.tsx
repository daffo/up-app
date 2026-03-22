import React, { useLayoutEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  StatusBar,
  GestureResponderEvent,
  PanResponderInstance,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';
import CachedImage from './CachedImage';
import RouteOverlay from './RouteOverlay';
import DragModeButtons from './DragModeButtons';
import { HandHold, DetectedHold } from '../types/database.types';
import { filterHoldsInRegion, mapHoldsToFocusRegion } from '../utils/focus-region';
import type { FocusRegion } from '../utils/focus-region';

interface FocusedViewLayout {
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
  imageX: number;
  imageY: number;
  scaledImageWidth: number;
  scaledImageHeight: number;
  scale: number;
}

interface FocusedHoldViewProps {
  photoUrl: string;
  focusRegion: FocusRegion;
  imageNaturalSize: { width: number; height: number };
  detectedHolds: DetectedHold[];
  selectedHoldId: string | null;
  onTapHold: (event: GestureResponderEvent) => void;
  onEditSelected: () => void;
  onExitFocus: () => void;
  // Zoom
  zoomSize: number;
  zoomMin: number;
  zoomMax: number;
  zoomStep: number;
  onAdjustZoom: (newSize: number) => void;
  // Move mode
  movingHoldId: string | null;
  holdDragPanHandlers: PanResponderInstance['panHandlers'];
  onCancelMove: () => void;
  onSaveMove: () => void;
  isSavingMove: boolean;
  // Redraw/Add mode
  redrawHoldId: string | null;
  isAddingHold: boolean;
  brushStrokes: Array<{ x: number; y: number }>;
  brushRadius: number;
  redrawPanHandlers: PanResponderInstance['panHandlers'];
  onCancelRedraw: () => void;
  onSaveRedraw: () => void;
  onCancelAddHold: () => void;
  onSaveAddHold: () => void;
  onStartAddHold: () => void;
  isSavingRedraw: boolean;
  // Refs for coordinate tracking
  focusedViewDimensionsRef: React.MutableRefObject<{ width: number; height: number }>;
  focusedViewOffsetRef: React.MutableRefObject<{ x: number; y: number }>;
}

function computeLayout(
  focusRegion: FocusRegion,
  imageNaturalSize: { width: number; height: number },
  windowDimensions: { width: number; height: number },
): FocusedViewLayout | null {
  if (!imageNaturalSize.width) return null;

  const naturalRegion = {
    x: (focusRegion.x / 100) * imageNaturalSize.width,
    y: (focusRegion.y / 100) * imageNaturalSize.height,
    width: (focusRegion.width / 100) * imageNaturalSize.width,
    height: (focusRegion.height / 100) * imageNaturalSize.height,
  };

  const regionAspect = naturalRegion.width / naturalRegion.height;
  const screenAspect = windowDimensions.width / windowDimensions.height;

  let displayWidth, displayHeight;
  if (regionAspect > screenAspect) {
    displayWidth = windowDimensions.width;
    displayHeight = windowDimensions.width / regionAspect;
  } else {
    displayHeight = windowDimensions.height;
    displayWidth = windowDimensions.height * regionAspect;
  }

  const scale = displayWidth / naturalRegion.width;
  const scaledImageWidth = imageNaturalSize.width * scale;
  const scaledImageHeight = imageNaturalSize.height * scale;

  const offsetX = (windowDimensions.width - displayWidth) / 2;
  const offsetY = (windowDimensions.height - displayHeight) / 2;

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
}

export default function FocusedHoldView({
  photoUrl,
  focusRegion,
  imageNaturalSize,
  detectedHolds,
  selectedHoldId,
  onTapHold,
  onEditSelected,
  onExitFocus,
  zoomSize,
  zoomMin,
  zoomMax,
  zoomStep,
  onAdjustZoom,
  movingHoldId,
  holdDragPanHandlers,
  onCancelMove,
  onSaveMove,
  isSavingMove,
  redrawHoldId,
  isAddingHold,
  brushStrokes,
  brushRadius,
  redrawPanHandlers,
  onCancelRedraw,
  onSaveRedraw,
  onCancelAddHold,
  onSaveAddHold,
  onStartAddHold,
  isSavingRedraw,
  focusedViewDimensionsRef,
  focusedViewOffsetRef,
}: FocusedHoldViewProps) {
  const { t } = useTranslation();
  const windowDimensions = useWindowDimensions();

  const layout = computeLayout(focusRegion, imageNaturalSize, windowDimensions);

  // Store dimensions and offset for PanResponder coordinate conversion
  // useLayoutEffect ensures refs are set before the next paint (PanResponder reads them synchronously)
  useLayoutEffect(() => {
    if (!layout) return;
    focusedViewDimensionsRef.current = { width: layout.displayWidth, height: layout.displayHeight };
    focusedViewOffsetRef.current = { x: layout.offsetX, y: layout.offsetY };
  }, [layout?.displayWidth, layout?.displayHeight, layout?.offsetX, layout?.offsetY]);

  if (!layout) return null;

  // Filter and map holds to focus region coordinate space
  const holdsInRegion = filterHoldsInRegion(detectedHolds, focusRegion);
  const mappedDetectedHolds = mapHoldsToFocusRegion(holdsInRegion, focusRegion);

  // Create fake "holds" from detected holds so RouteOverlay renders them
  const fakeHolds: HandHold[] = mappedDetectedHolds.map((dh, index) => ({
    order: index + 1,
    detected_hold_id: dh.id,
    labelX: 0,
    labelY: 0,
    note: '',
  }));

  const isMoving = !!movingHoldId;
  const isRedrawing = !!redrawHoldId;
  const isBrushing = isRedrawing || isAddingHold;
  const isEditing = isMoving || isBrushing;

  const activePanHandlers = isMoving
    ? holdDragPanHandlers
    : isBrushing
    ? redrawPanHandlers
    : {};

  return (
    <Modal visible={true} animationType="fade" statusBarTranslucent>
      <StatusBar hidden />
      <View style={styles.focusedContainer}>
        {/* Clipped image container */}
        <View
          style={{
            position: 'absolute',
            left: layout.offsetX,
            top: layout.offsetY,
            width: layout.displayWidth,
            height: layout.displayHeight,
            overflow: 'hidden',
          }}
          {...(isEditing ? activePanHandlers : {
            onStartShouldSetResponder: () => true,
            onResponderRelease: onTapHold,
          })}
        >
          <View pointerEvents="none">
            <CachedImage
              source={{ uri: photoUrl }}
              style={{
                position: 'absolute',
                left: layout.imageX - layout.offsetX,
                top: layout.imageY - layout.offsetY,
                width: layout.scaledImageWidth,
                height: layout.scaledImageHeight,
              }}
              contentFit="cover"
            />
          </View>
          {/* Hold overlay - hide during brush painting */}
          {!isBrushing && (
            <RouteOverlay
              handHolds={fakeHolds}
              detectedHolds={mappedDetectedHolds}
              width={layout.displayWidth}
              height={layout.displayHeight}
              pointerEvents="none"
              showLabels={false}
              selectedHoldId={movingHoldId || selectedHoldId}
              zoomScale={100 / (focusRegion.width || 100)}
            />
          )}
          {/* Brush strokes overlay */}
          {isBrushing && (
            <Svg
              width={layout.displayWidth}
              height={layout.displayHeight}
              style={StyleSheet.absoluteFill}
            >
              {brushStrokes.map((point, index) => (
                <Circle
                  key={index}
                  cx={(point.x / 100) * layout.displayWidth}
                  cy={(point.y / 100) * layout.displayHeight}
                  r={(brushRadius / 100) * layout.displayWidth}
                  fill="rgba(0, 200, 100, 0.6)"
                />
              ))}
            </Svg>
          )}
        </View>

        {/* Back/Cancel button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={isMoving ? onCancelMove : isRedrawing ? onCancelRedraw : isAddingHold ? onCancelAddHold : onExitFocus}
        >
          <Text style={styles.backButtonText}>{isEditing ? t('editor.cancel') : t('editor.back')}</Text>
        </TouchableOpacity>

        {/* Moving mode UI */}
        {isMoving && (
          <>
            <View style={styles.movingHelper}>
              <Text style={styles.movingHelperText}>{t('editor.dragToMoveHold')}</Text>
            </View>
            <DragModeButtons
              onCancel={onCancelMove}
              onSave={onSaveMove}
              isSaving={isSavingMove}
            />
          </>
        )}

        {/* Redraw mode UI */}
        {isRedrawing && (
          <>
            <View style={styles.movingHelper}>
              <Text style={styles.movingHelperText}>{t('editor.paintHoldShape')}</Text>
            </View>
            <DragModeButtons
              onCancel={onCancelRedraw}
              onSave={onSaveRedraw}
              isSaving={isSavingRedraw}
              saveDisabled={brushStrokes.length < 3}
            />
          </>
        )}

        {/* Add hold mode UI */}
        {isAddingHold && (
          <>
            <View style={styles.movingHelper}>
              <Text style={styles.movingHelperText}>{t('editor.paintNewHold')}</Text>
            </View>
            <DragModeButtons
              onCancel={onCancelAddHold}
              onSave={onSaveAddHold}
              isSaving={isSavingRedraw}
              saveDisabled={brushStrokes.length < 3}
            />
          </>
        )}

        {/* Edit button - show when a hold is selected and not editing */}
        {selectedHoldId && !isEditing && (
          <TouchableOpacity style={styles.editButton} onPress={onEditSelected}>
            <Text style={styles.editButtonText}>{t('editor.editHold')}</Text>
          </TouchableOpacity>
        )}

        {/* Add Hold button - show when no hold selected and not editing */}
        {!selectedHoldId && !isEditing && (
          <TouchableOpacity style={styles.addHoldButton} onPress={onStartAddHold}>
            <Text style={styles.addHoldButtonText}>{t('editor.addHold')}</Text>
          </TouchableOpacity>
        )}

        {/* Zoom +/- buttons - show when not editing */}
        {!isEditing && (
          <View style={styles.zoomButtonsContainer}>
            <TouchableOpacity
              style={[styles.zoomButton, zoomSize <= zoomMin && styles.zoomButtonDisabled]}
              onPress={() => onAdjustZoom(zoomSize - zoomStep)}
              disabled={zoomSize <= zoomMin}
              accessibilityLabel={t('editor.zoomIn')}
            >
              <Text style={[styles.zoomButtonText, zoomSize <= zoomMin && styles.zoomButtonTextDisabled]}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.zoomButton, zoomSize >= zoomMax && styles.zoomButtonDisabled]}
              onPress={() => onAdjustZoom(zoomSize + zoomStep)}
              disabled={zoomSize >= zoomMax}
              accessibilityLabel={t('editor.zoomOut')}
            >
              <Text style={[styles.zoomButtonText, zoomSize >= zoomMax && styles.zoomButtonTextDisabled]}>−</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  movingHelper: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  movingHelperText: {
    backgroundColor: 'rgba(0, 102, 204, 0.9)',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 16,
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
  addHoldButton: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(40, 167, 69, 0.95)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addHoldButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  zoomButtonsContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -52,
    gap: 8,
  },
  zoomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  zoomButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
});
