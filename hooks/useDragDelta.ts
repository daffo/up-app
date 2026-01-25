import { useState, useRef, useEffect, useCallback } from 'react';
import { PanResponder, PanResponderInstance, PanResponderGestureState } from 'react-native';

interface UseDragDeltaOptions {
  /** Function to get current dimensions for coordinate conversion */
  getDimensions: () => { width: number; height: number };
  /** Optional sensitivity multiplier (default 1.0) */
  sensitivity?: number;
  /**
   * Optional custom function to calculate delta from gesture.
   * If provided, getDimensions and sensitivity are ignored.
   * Receives gesture state and should return { x, y } delta in percentage.
   */
  calculateDelta?: (gestureState: PanResponderGestureState) => { x: number; y: number } | null;
}

interface UseDragDeltaReturn {
  /** Whether drag mode is active */
  isActive: boolean;
  /** Current delta from start position (in percentage) */
  delta: { x: number; y: number };
  /** PanResponder handlers to spread on the drag target */
  panHandlers: PanResponderInstance['panHandlers'];
  /** Start drag mode */
  start: () => void;
  /** Cancel drag and reset delta */
  cancel: () => void;
  /** Get final delta and reset (call this before saving) */
  complete: () => { x: number; y: number };
}

/**
 * Custom hook for drag-based movement with delta tracking.
 * Used for moving holds, labels, or other elements by dragging.
 */
export function useDragDelta({
  getDimensions,
  sensitivity = 1.0,
  calculateDelta,
}: UseDragDeltaOptions): UseDragDeltaReturn {
  const [isActive, setIsActive] = useState(false);
  const [delta, setDelta] = useState({ x: 0, y: 0 });

  // Refs to avoid stale closures in PanResponder
  const dragStartRef = useRef({ x: 0, y: 0 });
  const deltaRef = useRef({ x: 0, y: 0 });
  const getDimensionsRef = useRef(getDimensions);
  const calculateDeltaRef = useRef(calculateDelta);

  // Keep refs in sync
  useEffect(() => {
    deltaRef.current = delta;
  }, [delta]);

  useEffect(() => {
    getDimensionsRef.current = getDimensions;
  }, [getDimensions]);

  useEffect(() => {
    calculateDeltaRef.current = calculateDelta;
  }, [calculateDelta]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartRef.current = { x: deltaRef.current.x, y: deltaRef.current.y };
      },
      onPanResponderMove: (_, gestureState) => {
        let newDelta: { x: number; y: number };

        // Use custom calculation if provided
        if (calculateDeltaRef.current) {
          const result = calculateDeltaRef.current(gestureState);
          if (!result) return;
          newDelta = {
            x: dragStartRef.current.x + result.x,
            y: dragStartRef.current.y + result.y,
          };
        } else {
          // Default: convert pixel delta to percentage delta
          const dims = getDimensionsRef.current();
          if (dims.width === 0) return;

          const deltaXPercent = (gestureState.dx / dims.width) * 100 * sensitivity;
          const deltaYPercent = (gestureState.dy / dims.height) * 100 * sensitivity;
          newDelta = {
            x: dragStartRef.current.x + deltaXPercent,
            y: dragStartRef.current.y + deltaYPercent,
          };
        }

        setDelta(newDelta);
      },
      onPanResponderRelease: () => {
        // Keep delta - user will explicitly save or cancel
      },
    })
  ).current;

  const start = useCallback(() => {
    setIsActive(true);
    setDelta({ x: 0, y: 0 });
  }, []);

  const cancel = useCallback(() => {
    setIsActive(false);
    setDelta({ x: 0, y: 0 });
  }, []);

  const complete = useCallback(() => {
    const finalDelta = deltaRef.current;
    setIsActive(false);
    setDelta({ x: 0, y: 0 });
    return finalDelta;
  }, []);

  return {
    isActive,
    delta,
    panHandlers: panResponder.panHandlers,
    start,
    cancel,
    complete,
  };
}
