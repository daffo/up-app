import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Image as RNImage,
  useWindowDimensions,
  StatusBar,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';
import { Hold, DetectedHold } from '../types/database.types';
import { detectedHoldsApi, routesApi } from '../lib/api';
import FullScreenImageBase, { baseStyles, ImageDimensions } from './FullScreenImageBase';
import RouteOverlay from './RouteOverlay';
import DragModeButtons from './DragModeButtons';
import { findSmallestPolygonAtPoint } from '../utils/polygon';
import { useDragDelta } from '../hooks/useDragDelta';
import { useThemeColors } from '../lib/theme-context';

const ZOOM_MIN = 10;   // 10x magnification, tightest crop
const ZOOM_MAX = 60;   // ~1.7x magnification, widest view
const ZOOM_STEP = 5;
const ZOOM_DEFAULT = 15;

interface FullScreenHoldEditorProps {
  visible: boolean;
  photoUrl: string;
  holds: Hold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  photoId: string;
  onDeleteDetectedHold?: (holdId: string) => void;
  onUpdateDetectedHold?: (holdId: string, updates: Partial<DetectedHold>) => void;
  onAddDetectedHold?: (hold: DetectedHold) => void;
}

type FocusMode = 'none' | 'selecting' | 'focused';

interface FocusRegion {
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
}

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
  const colors = useThemeColors();
  const windowDimensions = useWindowDimensions();
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
  // locationX/Y are already relative to the image container since pan handlers are there
  const addBrushPointFromRef = (localX: number, localY: number) => {
    const dims = focusedViewDimensionsRef.current;
    if (dims.width === 0) return;

    // Convert to percentage within focused view (0-100)
    const xPercent = (localX / dims.width) * 100;
    const yPercent = (localY / dims.height) * 100;

    // Only add if within bounds
    if (xPercent >= 0 && xPercent <= 100 && yPercent >= 0 && yPercent <= 100) {
      const newStrokes = [...brushStrokesRef.current, { x: xPercent, y: yPercent }];
      brushStrokesRef.current = newStrokes;
      setBrushStrokes(newStrokes);
    }
  };

  // Start moving mode
  const startMoveHold = () => {
    setMovingHoldId(selectedHoldId);
    holdDrag.start();
    setDeleteModalVisible(false);
  };

  // Cancel move
  const cancelMove = () => {
    setMovingHoldId(null);
    holdDrag.cancel();
  };

  // Save move to database
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

    // Calculate new polygon and center
    const newPolygon = holdToMove.polygon.map(p => ({
      x: p.x + delta.x,
      y: p.y + delta.y,
    }));
    const newCenter = {
      x: holdToMove.center.x + delta.x,
      y: holdToMove.center.y + delta.y,
    };

    // Update in database
    try {
      await detectedHoldsApi.update(movingHoldId, { polygon: newPolygon, center: newCenter });
    } catch (err) {
      setIsSavingMove(false);
      Alert.alert(t('common.error'), t('editor.errorMoveHold') + ': ' + (err instanceof Error ? err.message : String(err)));
      return;
    }

    setIsSavingMove(false);

    // Notify parent to update state
    if (onUpdateDetectedHold) {
      onUpdateDetectedHold(movingHoldId, { polygon: newPolygon, center: newCenter });
    }

    setMovingHoldId(null);
    setSelectedHoldId(null);
  };

  // Start redraw mode
  const startRedraw = () => {
    setRedrawHoldId(selectedHoldId);
    setBrushStrokes([]);
    setDeleteModalVisible(false);
  };

  // Cancel redraw
  const cancelRedraw = () => {
    setRedrawHoldId(null);
    setBrushStrokes([]);
  };

  // Save redrawn shape
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

    // Convert brush strokes to a polygon using the outline extraction algorithm
    const newPolygonInFocusCoords = extractOutlineFromBrushStrokes(brushStrokes, brushRadius);

    // Convert from focus region coordinates back to original image coordinates
    const newPolygon = newPolygonInFocusCoords.map(p => ({
      x: focusRegion.x + (p.x / 100) * focusRegion.width,
      y: focusRegion.y + (p.y / 100) * focusRegion.height,
    }));

    // Calculate new center
    const newCenter = {
      x: newPolygon.reduce((sum, p) => sum + p.x, 0) / newPolygon.length,
      y: newPolygon.reduce((sum, p) => sum + p.y, 0) / newPolygon.length,
    };

    // Update in database
    try {
      await detectedHoldsApi.update(redrawHoldId, { polygon: newPolygon, center: newCenter });
    } catch (err) {
      setIsSavingRedraw(false);
      Alert.alert(t('common.error'), t('editor.errorRedrawHold') + ': ' + (err instanceof Error ? err.message : String(err)));
      return;
    }

    setIsSavingRedraw(false);

    // Notify parent to update state
    if (onUpdateDetectedHold) {
      onUpdateDetectedHold(redrawHoldId, { polygon: newPolygon, center: newCenter });
    }

    setRedrawHoldId(null);
    setBrushStrokes([]);
    setSelectedHoldId(null);
  };

  // Start add hold mode
  const startAddHold = () => {
    setIsAddingHold(true);
    setBrushStrokes([]);
    setSelectedHoldId(null);
  };

  // Cancel add hold
  const cancelAddHold = () => {
    setIsAddingHold(false);
    setBrushStrokes([]);
  };

  // Save new hold
  const saveAddHold = async () => {
    if (brushStrokes.length < 3) {
      Alert.alert(t('common.error'), t('editor.errorDrawMore'));
      return;
    }

    if (!focusRegion) {
      cancelAddHold();
      return;
    }

    setIsSavingRedraw(true); // Reuse the saving state

    // Convert brush strokes to a polygon using the outline extraction algorithm
    const newPolygonInFocusCoords = extractOutlineFromBrushStrokes(brushStrokes, brushRadius);

    // Convert from focus region coordinates back to original image coordinates
    const newPolygon = newPolygonInFocusCoords.map(p => ({
      x: focusRegion.x + (p.x / 100) * focusRegion.width,
      y: focusRegion.y + (p.y / 100) * focusRegion.height,
    }));

    // Calculate center
    const newCenter = {
      x: newPolygon.reduce((sum, p) => sum + p.x, 0) / newPolygon.length,
      y: newPolygon.reduce((sum, p) => sum + p.y, 0) / newPolygon.length,
    };

    // Insert new hold into database
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

    // Notify parent to update state
    if (onAddDetectedHold) {
      onAddDetectedHold(newHold);
    }

    setIsAddingHold(false);
    setBrushStrokes([]);
  };

  // Extract outline from brush strokes using a grid-based approach
  const extractOutlineFromBrushStrokes = (
    strokes: Array<{ x: number; y: number }>,
    radius: number
  ): Array<{ x: number; y: number }> => {
    // Create a grid to represent the painted area
    const gridSize = 100; // 100x100 grid for 0-100% coordinate space
    const grid: boolean[][] = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));

    // Mark cells that are within brush radius of any stroke point
    const radiusCells = Math.ceil(radius);
    for (const point of strokes) {
      const centerX = Math.floor(point.x);
      const centerY = Math.floor(point.y);

      for (let dy = -radiusCells; dy <= radiusCells; dy++) {
        for (let dx = -radiusCells; dx <= radiusCells; dx++) {
          const gx = centerX + dx;
          const gy = centerY + dy;
          if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius) {
              grid[gy][gx] = true;
            }
          }
        }
      }
    }

    // Extract contour using marching squares (simplified)
    const contourPoints: Array<{ x: number; y: number }> = [];

    // Find edge cells (filled cells adjacent to empty cells or boundary)
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (grid[y][x]) {
          // Check if this is an edge cell
          const isEdge =
            x === 0 || x === gridSize - 1 || y === 0 || y === gridSize - 1 ||
            !grid[y - 1]?.[x] || !grid[y + 1]?.[x] ||
            !grid[y]?.[x - 1] || !grid[y]?.[x + 1];

          if (isEdge) {
            contourPoints.push({ x, y });
          }
        }
      }
    }

    if (contourPoints.length < 3) {
      // Fallback: return convex hull of stroke points
      return computeConvexHull(strokes);
    }

    // Use convex hull of edge points for a clean polygon
    // This won't capture concave shapes perfectly, but gives reliable results
    const hull = computeConvexHull(contourPoints);

    // Simplify the hull to reduce point count
    const simplified = simplifyPolygon(hull, 1.5);

    return simplified;
  };

  // Douglas-Peucker polygon simplification
  const simplifyPolygon = (
    points: Array<{ x: number; y: number }>,
    epsilon: number
  ): Array<{ x: number; y: number }> => {
    if (points.length <= 2) return points;

    // Find the point with maximum distance from line between first and last
    let maxDist = 0;
    let maxIndex = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = perpendicularDistance(points[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    // If max distance is greater than epsilon, recursively simplify
    if (maxDist > epsilon) {
      const left = simplifyPolygon(points.slice(0, maxIndex + 1), epsilon);
      const right = simplifyPolygon(points.slice(maxIndex), epsilon);
      return [...left.slice(0, -1), ...right];
    } else {
      return [first, last];
    }
  };

  // Calculate perpendicular distance from point to line
  const perpendicularDistance = (
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
  ): number => {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);

    const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
    const closestX = lineStart.x + u * dx;
    const closestY = lineStart.y + u * dy;
    return Math.sqrt((point.x - closestX) ** 2 + (point.y - closestY) ** 2);
  };

  // Compute convex hull using Graham scan
  const computeConvexHull = (points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> => {
    if (points.length < 3) return points;

    // Find bottom-most point (or left-most in case of tie)
    let start = 0;
    for (let i = 1; i < points.length; i++) {
      if (points[i].y < points[start].y ||
          (points[i].y === points[start].y && points[i].x < points[start].x)) {
        start = i;
      }
    }

    const pivot = points[start];

    // Sort by polar angle with pivot
    const sorted = points
      .filter((_, i) => i !== start)
      .sort((a, b) => {
        const angleA = Math.atan2(a.y - pivot.y, a.x - pivot.x);
        const angleB = Math.atan2(b.y - pivot.y, b.x - pivot.x);
        return angleA - angleB;
      });

    const hull: Array<{ x: number; y: number }> = [pivot];

    for (const point of sorted) {
      while (hull.length > 1) {
        const top = hull[hull.length - 1];
        const second = hull[hull.length - 2];
        const cross = (top.x - second.x) * (point.y - second.y) - (top.y - second.y) * (point.x - second.x);
        if (cross <= 0) {
          hull.pop();
        } else {
          break;
        }
      }
      hull.push(point);
    }

    return hull;
  };

  // Get detected holds with moving delta applied
  const getDisplayedDetectedHolds = () => {
    if (!movingHoldId) return detectedHolds;
    return detectedHolds.map(hold => {
      if (hold.id !== movingHoldId) return hold;
      return {
        ...hold,
        polygon: hold.polygon.map(p => ({
          x: p.x + holdDrag.delta.x,
          y: p.y + holdDrag.delta.y,
        })),
        center: {
          x: hold.center.x + holdDrag.delta.x,
          y: hold.center.y + holdDrag.delta.y,
        },
      };
    });
  };

  // Handle tap on image - select hold on tap, deselect if tapping elsewhere
  const handleImageTap = (event: any) => {
    if (imageDimensions.width === 0) return;

    const { locationX, locationY } = event;

    // Convert screen coordinates to image-relative coordinates
    const imageX = locationX - imageOffset.x;
    const imageY = locationY - imageOffset.y;

    // Check if tap is outside the image bounds
    if (imageX < 0 || imageX > imageDimensions.width ||
        imageY < 0 || imageY > imageDimensions.height) {
      setSelectedHoldId(null); // Deselect on tap outside
      return;
    }

    // Convert to percentages
    const xPercent = (imageX / imageDimensions.width) * 100;
    const yPercent = (imageY / imageDimensions.height) * 100;

    // Find smallest hold at tap point
    const tappedHold = findSmallestPolygonAtPoint(xPercent, yPercent, detectedHolds);
    if (tappedHold) {
      // Select hold (or toggle if already selected)
      setSelectedHoldId(tappedHold.id === selectedHoldId ? null : tappedHold.id);
    } else {
      // Deselect if tapping on empty area
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

    // Check if this hold is used in any route
    try {
      const routes = await routesApi.listByPhoto(photoId);

      const usingRoutes: string[] = [];
      for (const r of routes) {
        const routeHolds = r.holds as Hold[];
        if (routeHolds.some(h => h.detected_hold_id === selectedHold.id)) {
          usingRoutes.push(r.title);
        }
      }

      // If hold is used in routes, go back to edit view to show route list
      if (usingRoutes.length > 0) {
        setIsDeleting(false);
        setConfirmingDelete(false);
        setRoutesUsingHold(usingRoutes);
        return;
      }

      // Delete the hold
      await detectedHoldsApi.delete(selectedHold.id);
    } catch (err) {
      setIsDeleting(false);
      Alert.alert(t('common.error'), err instanceof Error ? err.message : String(err));
      return;
    }

    setIsDeleting(false);

    // Notify parent to update state
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
      RNImage.getSize(photoUrl, (width, height) => {
        setImageNaturalSize({ width, height });
      });
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

    // Clamp to image bounds
    const centerX = Math.max(0, Math.min(100, percent.x));
    const centerY = Math.max(0, Math.min(100, percent.y));

    const halfSize = zoomSize / 2;

    let minX = centerX - halfSize;
    let maxX = centerX + halfSize;
    let minY = centerY - halfSize;
    let maxY = centerY + halfSize;

    // Shift region to stay within bounds
    if (minX < 0) {
      maxX -= minX;
      minX = 0;
    }
    if (maxX > 100) {
      minX -= (maxX - 100);
      maxX = 100;
    }
    if (minY < 0) {
      maxY -= minY;
      minY = 0;
    }
    if (maxY > 100) {
      minY -= (maxY - 100);
      maxY = 100;
    }

    // Final clamp
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(100, maxX);
    maxY = Math.min(100, maxY);

    setFocusRegion({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
    setFocusMode('focused');
  };

  // Start focus selection mode
  const startFocusSelection = () => {
    setFocusMode('selecting');
  };

  // Adjust zoom level while in focused mode
  const adjustZoom = (newZoomSize: number) => {
    if (!focusRegion) return;
    const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoomSize));
    setZoomSize(clamped);

    // Recalculate focus region around current center
    const currentCenterX = focusRegion.x + focusRegion.width / 2;
    const currentCenterY = focusRegion.y + focusRegion.height / 2;
    const halfSize = clamped / 2;

    let minX = currentCenterX - halfSize;
    let maxX = currentCenterX + halfSize;
    let minY = currentCenterY - halfSize;
    let maxY = currentCenterY + halfSize;

    // Shift region to stay within bounds
    if (minX < 0) { maxX -= minX; minX = 0; }
    if (maxX > 100) { minX -= (maxX - 100); maxX = 100; }
    if (minY < 0) { maxY -= minY; minY = 0; }
    if (maxY > 100) { minY -= (maxY - 100); maxY = 100; }

    // Final clamp
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(100, maxX);
    maxY = Math.min(100, maxY);

    setFocusRegion({
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
  };

  // Exit focus mode
  const exitFocusMode = () => {
    setFocusMode('none');
    setFocusRegion(null);
    setZoomSize(ZOOM_DEFAULT);
    focusedViewDimensionsRef.current = { width: 0, height: 0 };
    focusedViewOffsetRef.current = { x: 0, y: 0 };
  };

  // Cancel selection
  const cancelSelection = () => {
    setFocusMode('none');
  };

  // Get holds in current focus region (for focused mode)
  const getHoldsInRegion = () => {
    if (!focusRegion) return [];
    return detectedHolds.filter(hold => {
      const centerX = hold.polygon.reduce((sum, p) => sum + p.x, 0) / hold.polygon.length;
      const centerY = hold.polygon.reduce((sum, p) => sum + p.y, 0) / hold.polygon.length;
      return (
        centerX >= focusRegion.x &&
        centerX <= focusRegion.x + focusRegion.width &&
        centerY >= focusRegion.y &&
        centerY <= focusRegion.y + focusRegion.height
      );
    });
  };

  // Handle tap in focused view - manual hit testing (works on web unlike SVG onPressIn)
  const handleFocusedViewTap = (event: GestureResponderEvent) => {
    if (focusMode !== 'focused' || !focusRegion) return;

    const { locationX, locationY } = event.nativeEvent;
    const dims = focusedViewDimensionsRef.current;
    if (dims.width === 0) return;

    // Convert tap coordinates to original image percentage coordinates
    const xPercent = focusRegion.x + (locationX / dims.width) * focusRegion.width;
    const yPercent = focusRegion.y + (locationY / dims.height) * focusRegion.height;

    // Find tapped hold (uses displayed holds which include move delta)
    const tappedHold = findSmallestPolygonAtPoint(xPercent, yPercent, getDisplayedDetectedHolds());
    if (tappedHold) {
      setSelectedHoldId(tappedHold.id === selectedHoldId ? null : tappedHold.id);
    } else {
      setSelectedHoldId(null);
    }
  };

  // Calculate focused view dimensions and image positioning
  const getFocusedViewProps = () => {
    if (!focusRegion || !imageNaturalSize.width) return null;

    // The region in the natural image
    const naturalRegion = {
      x: (focusRegion.x / 100) * imageNaturalSize.width,
      y: (focusRegion.y / 100) * imageNaturalSize.height,
      width: (focusRegion.width / 100) * imageNaturalSize.width,
      height: (focusRegion.height / 100) * imageNaturalSize.height,
    };

    // Aspect ratio of the region
    const regionAspect = naturalRegion.width / naturalRegion.height;
    const screenAspect = windowDimensions.width / windowDimensions.height;

    // Calculate display size to fit region on screen
    let displayWidth, displayHeight;
    if (regionAspect > screenAspect) {
      displayWidth = windowDimensions.width;
      displayHeight = windowDimensions.width / regionAspect;
    } else {
      displayHeight = windowDimensions.height;
      displayWidth = windowDimensions.height * regionAspect;
    }

    // Scale factor from natural region to display
    const scale = displayWidth / naturalRegion.width;

    // Full image size when scaled
    const scaledImageWidth = imageNaturalSize.width * scale;
    const scaledImageHeight = imageNaturalSize.height * scale;

    // Position to center the region
    const offsetX = (windowDimensions.width - displayWidth) / 2;
    const offsetY = (windowDimensions.height - displayHeight) / 2;

    // Image position (negative to shift the region into view)
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
  };

  // Render focused view
  const renderFocusedView = () => {
    const props = getFocusedViewProps();
    if (!props || !focusRegion) return null;

    // Store focused view dimensions and offset for PanResponder
    focusedViewDimensionsRef.current = { width: props.displayWidth, height: props.displayHeight };
    focusedViewOffsetRef.current = { x: props.offsetX, y: props.offsetY };

    // Get holds in region (use displayed holds which include moving delta)
    const displayedHolds = getDisplayedDetectedHolds();
    const holdsInRegion = displayedHolds.filter(hold => {
      const centerX = hold.polygon.reduce((sum, p) => sum + p.x, 0) / hold.polygon.length;
      const centerY = hold.polygon.reduce((sum, p) => sum + p.y, 0) / hold.polygon.length;
      return (
        centerX >= focusRegion.x &&
        centerX <= focusRegion.x + focusRegion.width &&
        centerY >= focusRegion.y &&
        centerY <= focusRegion.y + focusRegion.height
      );
    });

    // Map detected holds to new coordinate system (relative to focus region)
    const mappedDetectedHolds = holdsInRegion.map(hold => ({
      ...hold,
      polygon: hold.polygon.map(p => ({
        x: ((p.x - focusRegion.x) / focusRegion.width) * 100,
        y: ((p.y - focusRegion.y) / focusRegion.height) * 100,
      })),
      center: {
        x: ((hold.center.x - focusRegion.x) / focusRegion.width) * 100,
        y: ((hold.center.y - focusRegion.y) / focusRegion.height) * 100,
      },
    }));

    // Create fake "holds" from detected holds so RouteOverlay renders them
    const fakeHolds: Hold[] = mappedDetectedHolds.map((dh, index) => ({
      order: index + 1,
      detected_hold_id: dh.id,
      labelX: 0, // Not used since showLabels=false
      labelY: 0,
      note: '',
    }));

    const isMoving = !!movingHoldId;
    const isRedrawing = !!redrawHoldId;
    const isBrushing = isRedrawing || isAddingHold; // Both use brush painting
    const isEditing = isMoving || isBrushing;

    // Determine which pan responder to use
    const activePanHandlers = isMoving
      ? holdDrag.panHandlers
      : isBrushing
      ? redrawPanResponder.panHandlers
      : {};

    return (
      <Modal visible={true} animationType="fade" statusBarTranslucent>
        <StatusBar hidden />
        <View style={styles.focusedContainer}>
          {/* Clipped image container - pan handlers when editing, tap handler otherwise */}
          <View
            style={{
              position: 'absolute',
              left: props.offsetX,
              top: props.offsetY,
              width: props.displayWidth,
              height: props.displayHeight,
              overflow: 'hidden',
            }}
            {...(isEditing ? activePanHandlers : {
              onStartShouldSetResponder: () => true,
              onResponderRelease: handleFocusedViewTap,
            })}
          >
            <View pointerEvents="none">
              <Image
                source={{ uri: photoUrl }}
                style={{
                  position: 'absolute',
                  left: props.imageX - props.offsetX,
                  top: props.imageY - props.offsetY,
                  width: props.scaledImageWidth,
                  height: props.scaledImageHeight,
                }}
                contentFit="cover"
              />
            </View>
            {/* Overlay for holds in this region - hide during brush painting */}
            {!isBrushing && (
              <RouteOverlay
                holds={fakeHolds}
                detectedHolds={mappedDetectedHolds}
                width={props.displayWidth}
                height={props.displayHeight}
                pointerEvents="none"
                showLabels={false}
                selectedHoldId={movingHoldId || selectedHoldId}
                zoomScale={100 / (focusRegion?.width || 100)}
              />
            )}
            {/* Brush strokes overlay during redraw or add */}
            {isBrushing && (
              <Svg
                width={props.displayWidth}
                height={props.displayHeight}
                style={StyleSheet.absoluteFill}
              >
                {brushStrokes.map((point, index) => (
                  <Circle
                    key={index}
                    cx={(point.x / 100) * props.displayWidth}
                    cy={(point.y / 100) * props.displayHeight}
                    r={(brushRadius / 100) * props.displayWidth}
                    fill="rgba(0, 200, 100, 0.6)"
                  />
                ))}
              </Svg>
            )}
          </View>

          {/* Back/Cancel button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={isMoving ? cancelMove : isRedrawing ? cancelRedraw : isAddingHold ? cancelAddHold : exitFocusMode}
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
                onCancel={cancelMove}
                onSave={saveMove}
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
                onCancel={cancelRedraw}
                onSave={saveRedraw}
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
                onCancel={cancelAddHold}
                onSave={saveAddHold}
                isSaving={isSavingRedraw}
                saveDisabled={brushStrokes.length < 3}
              />
            </>
          )}

          {/* Edit button - show when a hold is selected and not editing */}
          {selectedHoldId && !isEditing && (
            <TouchableOpacity style={styles.editButton} onPress={handleEditSelected}>
              <Text style={styles.editButtonText}>{t('editor.editHold')}</Text>
            </TouchableOpacity>
          )}

          {/* Add Hold button - show when no hold selected and not editing */}
          {!selectedHoldId && !isEditing && (
            <TouchableOpacity style={styles.addHoldButton} onPress={startAddHold}>
              <Text style={styles.addHoldButtonText}>{t('editor.addHold')}</Text>
            </TouchableOpacity>
          )}

          {/* Zoom +/- buttons - show when not editing */}
          {!isEditing && (
            <View style={styles.zoomButtonsContainer}>
              <TouchableOpacity
                style={[styles.zoomButton, zoomSize <= ZOOM_MIN && styles.zoomButtonDisabled]}
                onPress={() => adjustZoom(zoomSize - ZOOM_STEP)}
                disabled={zoomSize <= ZOOM_MIN}
                accessibilityLabel={t('editor.zoomIn')}
              >
                <Text style={[styles.zoomButtonText, zoomSize <= ZOOM_MIN && styles.zoomButtonTextDisabled]}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.zoomButton, zoomSize >= ZOOM_MAX && styles.zoomButtonDisabled]}
                onPress={() => adjustZoom(zoomSize + ZOOM_STEP)}
                disabled={zoomSize >= ZOOM_MAX}
                accessibilityLabel={t('editor.zoomOut')}
              >
                <Text style={[styles.zoomButtonText, zoomSize >= ZOOM_MAX && styles.zoomButtonTextDisabled]}>−</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  // Check if we're in focused mode
  const inFocusedMode = focusMode === 'focused' && focusRegion;

  // Render the edit modal (shared between normal and focused view)
  const renderEditModal = () => (
    <Modal
      visible={deleteModalVisible}
      transparent
      animationType="fade"
      onRequestClose={closeModal}
    >
      <TouchableOpacity
        style={baseStyles.modalOverlay}
        activeOpacity={1}
        onPress={closeModal}
      >
        <TouchableOpacity activeOpacity={1} style={[baseStyles.modalContent, { backgroundColor: colors.cardBackground }]}>
          {confirmingDelete ? (
            <>
              <Text style={[baseStyles.modalTitle, { color: colors.textPrimary }]}>{t('editor.deleteHold')}</Text>
              <Text style={[styles.confirmText, { color: colors.textSecondary }]}>{t('editor.deleteHoldConfirm')}</Text>
              <TouchableOpacity
                style={[baseStyles.modalButton, baseStyles.modalButtonDanger]}
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={baseStyles.modalButtonText}>{t('common.delete')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
                onPress={() => setConfirmingDelete(false)}
              >
                <Text style={baseStyles.modalButtonText}>{t('editor.cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[baseStyles.modalTitle, { color: colors.textPrimary }]}>{t('editor.editHold')}</Text>

              {routesUsingHold.length > 0 && (
                <>
                  <Text style={styles.warningText}>
                    {t('editor.cannotDelete', { count: routesUsingHold.length })}
                  </Text>
                  {routesUsingHold.map((title, i) => (
                    <Text key={i} style={[styles.routeListItem, { color: colors.textSecondary }]}>• {title}</Text>
                  ))}
                </>
              )}

              {/* Move and Redraw only available in focused mode */}
              {inFocusedMode ? (
                <>
                  <TouchableOpacity
                    style={baseStyles.modalButton}
                    onPress={startMoveHold}
                  >
                    <Text style={baseStyles.modalButtonText}>{t('editor.moveHold')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={baseStyles.modalButton}
                    onPress={startRedraw}
                  >
                    <Text style={baseStyles.modalButtonText}>{t('editor.redrawShape')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={[styles.hintText, { color: colors.textTertiary }]}>
                  {t('editor.usePrecisionHint')}
                </Text>
              )}

              <TouchableOpacity
                style={[baseStyles.modalButton, baseStyles.modalButtonDanger]}
                onPress={handleDeleteHold}
                disabled={isDeleting || routesUsingHold.length > 0}
              >
                <Text style={baseStyles.modalButtonText}>{t('editor.deleteHold')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
                onPress={closeModal}
              >
                <Text style={baseStyles.modalButtonText}>{t('editor.cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // If in focused mode, render the focused view instead
  if (focusMode === 'focused' && focusRegion) {
    return (
      <>
        {renderFocusedView()}
        {renderEditModal()}
      </>
    );
  }

  return (
    <FullScreenImageBase
      visible={visible}
      photoUrl={photoUrl}
      holds={holds}
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

      {renderEditModal()}
    </FullScreenImageBase>
  );
}

const styles = StyleSheet.create({
  confirmText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#dc3545',
    marginBottom: 8,
  },
  routeListItem: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
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
  focusInfo: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  focusInfoText: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
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
  zoomButtonsContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -52, // Half of total height (2 buttons × 44 + 8 gap) / 2
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
