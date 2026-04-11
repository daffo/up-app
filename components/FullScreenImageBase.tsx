import { useState, useEffect, useRef, ReactNode } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ImageZoom from 'react-native-image-pan-zoom';
import CachedImage from './CachedImage';
import { getImageDimensions } from '../lib/cache/image-cache';
import { HandHold, FootHold, DetectedHold } from '../types/database.types';
import RouteOverlay from './RouteOverlay';

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ZoomState {
  scale: number;
  positionX: number;
  positionY: number;
}

export interface FullScreenImageBaseProps {
  visible: boolean;
  photoUrl: string;
  handHolds: HandHold[];
  footHolds?: FootHold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  showLabels?: boolean;
  closeButtonText?: string;
  // Optional callbacks for customization
  onImageTap?: (event: any) => void;
  onHandHoldPress?: (index: number) => void;
  // For rendering additional controls/modals
  children?: ReactNode;
  // For PanResponder integration
  panHandlers?: any;
  // For edit mode visual feedback
  resizingHoldIndex?: number | null;
  // Enable pointer events on overlay
  overlayPointerEvents?: 'none' | 'auto' | 'box-none';
  // Expose refs for advanced usage
  onZoomChange?: (zoomState: ZoomState) => void;
  onDimensionsReady?: (dimensions: ImageDimensions, offset: { x: number; y: number }) => void;
  // Optional header configuration
  headerTitle?: string;
  headerRight?: ReactNode;
  // Optional helper banner (shown below header)
  helperBanner?: ReactNode;
  // Selected hold for highlighting
  selectedHoldId?: string | null;
  // Lock pan/zoom (for move mode)
  lockZoom?: boolean;
}

export default function FullScreenImageBase({
  visible,
  photoUrl,
  handHolds,
  footHolds = [],
  detectedHolds,
  onClose,
  showLabels = true,
  closeButtonText = '✕',
  onImageTap,
  onHandHoldPress,
  children,
  panHandlers,
  resizingHoldIndex = null,
  overlayPointerEvents = 'none',
  onZoomChange,
  onDimensionsReady,
  headerTitle,
  headerRight,
  helperBanner,
  selectedHoldId = null,
  lockZoom = false,
}: FullScreenImageBaseProps) {
  const windowDimensions = useWindowDimensions();
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  // Zoom state tracking
  const zoomStateRef = useRef<ZoomState>({ scale: 1, positionX: 0, positionY: 0 });
  // Keep onImageTap in a ref so touch handlers always have the latest callback
  const onImageTapRef = useRef(onImageTap);
  onImageTapRef.current = onImageTap;
  // Store container viewport position on layout — used for mobile touch tap coordinates
  // (getBoundingClientRect during touch events is unreliable on some mobile browsers)
  const webContainerPosRef = useRef({ left: 0, top: 0 });
  const webContainerSizeRef = useRef({ width: 0, height: 0 });

  // On web, measure actual container; on native, use window dimensions (ImageZoom needs explicit sizes)
  const effectiveSize = Platform.OS === 'web' && containerSize.width > 0 ? containerSize : windowDimensions;

  useEffect(() => {
    if (visible) {
      getImageDimensions(photoUrl).then(({ width, height }) => {
        setImageNaturalSize({ width, height });
      }).catch(() => {});
    }
  }, [visible, photoUrl]);

  // Calculate actual displayed image dimensions based on contain mode
  const getDisplayedImageDimensions = (): ImageDimensions => {
    if (!imageNaturalSize.width || !imageNaturalSize.height || !effectiveSize.width) {
      return { width: 0, height: 0 };
    }

    const imageAspect = imageNaturalSize.width / imageNaturalSize.height;
    const containerAspect = effectiveSize.width / effectiveSize.height;

    let displayWidth, displayHeight;

    if (imageAspect > containerAspect) {
      displayWidth = effectiveSize.width;
      displayHeight = effectiveSize.width / imageAspect;
    } else {
      displayHeight = effectiveSize.height;
      displayWidth = effectiveSize.height * imageAspect;
    }

    return { width: displayWidth, height: displayHeight };
  };

  const displayedDimensions = getDisplayedImageDimensions();

  // Calculate centering offsets for SVG overlay
  const offsetX = (effectiveSize.width - displayedDimensions.width) / 2;
  const offsetY = (effectiveSize.height - displayedDimensions.height) / 2;

  // Notify parent of dimensions when ready
  useEffect(() => {
    if (displayedDimensions.width > 0 && onDimensionsReady) {
      onDimensionsReady(displayedDimensions, { x: offsetX, y: offsetY });
    }
  }, [displayedDimensions.width, displayedDimensions.height]);

  const handleZoomChange = (position: any) => {
    zoomStateRef.current = {
      scale: position.scale,
      positionX: position.positionX,
      positionY: position.positionY,
    };
    if (onZoomChange) {
      onZoomChange(zoomStateRef.current);
    }
  };

  // --- Web zoom/pan state ---
  const [webScale, setWebScale] = useState(1);
  const [webTranslate, setWebTranslate] = useState({ x: 0, y: 0 });
  // Refs to track latest scale/translate for use in touch event closures
  const webScaleRef = useRef(1);
  const webTranslateRef = useRef({ x: 0, y: 0 });
  const webDragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({ dragging: false, lastX: 0, lastY: 0 });
  const webTouchRef = useRef<{ lastDist: number; lastMidX: number; lastMidY: number }>({ lastDist: 0, lastMidX: 0, lastMidY: 0 });
  // Track touch start position to detect taps vs drags
  const webTapRef = useRef<{ startX: number; startY: number; moved: boolean; time: number; handled: boolean }>({ startX: 0, startY: 0, moved: false, time: 0, handled: false });
  const webZoomRef = useRef<HTMLDivElement | null>(null);

  // Reset web zoom state when modal opens
  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      setWebScale(1);
      setWebTranslate({ x: 0, y: 0 });
      webScaleRef.current = 1;
      webTranslateRef.current = { x: 0, y: 0 };
    }
  }, [visible]);

  // Keep refs in sync with state for touch handler closures
  useEffect(() => { webScaleRef.current = webScale; }, [webScale]);
  useEffect(() => { webTranslateRef.current = webTranslate; }, [webTranslate]);

  // Wheel + touch handlers need { passive: false } to call preventDefault
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const el = webZoomRef.current;
    if (!el) return;

    // Desktop: wheel zoom
    const onWheel = (e: WheelEvent) => {
      if (lockZoom) return;
      e.preventDefault();
      e.stopPropagation();
      setWebScale(prev => {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const next = Math.min(4, Math.max(1, prev * delta));
        if (next <= 1) setWebTranslate({ x: 0, y: 0 });
        return next;
      });
    };

    // Mobile: pinch zoom + two-finger pan
    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);

    const TAP_THRESHOLD = 10; // px — max movement to still count as a tap

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        webTapRef.current.moved = true; // multi-touch is never a tap
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        webTouchRef.current = { lastDist: dist, lastMidX: midX, lastMidY: midY };
      } else if (e.touches.length === 1) {
        // Track for tap detection
        webTapRef.current = {
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          moved: false,
          time: Date.now(),
          handled: false,
        };
        // Single finger drag when zoomed in
        webDragRef.current = { dragging: true, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && !lockZoom) {
        e.preventDefault();
        const dist = getTouchDist(e.touches[0], e.touches[1]);
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        const scaleDelta = dist / webTouchRef.current.lastDist;
        setWebScale(prev => {
          const next = Math.min(4, Math.max(1, prev * scaleDelta));
          if (next <= 1) setWebTranslate({ x: 0, y: 0 });
          return next;
        });

        // Pan while pinching
        const dx = midX - webTouchRef.current.lastMidX;
        const dy = midY - webTouchRef.current.lastMidY;
        setWebTranslate(prev => ({ x: prev.x + dx, y: prev.y + dy }));

        webTouchRef.current = { lastDist: dist, lastMidX: midX, lastMidY: midY };
      } else if (e.touches.length === 1) {
        // Check if moved enough to disqualify as tap
        const dx = e.touches[0].clientX - webTapRef.current.startX;
        const dy = e.touches[0].clientY - webTapRef.current.startY;
        if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) {
          webTapRef.current.moved = true;
        }
        // Single finger pan when zoomed
        if (webDragRef.current.dragging) {
          setWebScale(currentScale => {
            if (currentScale > 1) {
              const ddx = e.touches[0].clientX - webDragRef.current.lastX;
              const ddy = e.touches[0].clientY - webDragRef.current.lastY;
              webDragRef.current.lastX = e.touches[0].clientX;
              webDragRef.current.lastY = e.touches[0].clientY;
              setWebTranslate(prev => ({ x: prev.x + ddx, y: prev.y + ddy }));
            }
            return currentScale;
          });
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      webDragRef.current.dragging = false;
      // Detect tap: single finger, didn't move much, quick touch
      if (!webTapRef.current.moved && (Date.now() - webTapRef.current.time) < 300 && onImageTapRef.current) {
        // Position relative to container in viewport space
        const visualX = webTapRef.current.startX - webContainerPosRef.current.left;
        const visualY = webTapRef.current.startY - webContainerPosRef.current.top;

        // Inverse-transform to account for zoom/pan
        // CSS transform: translateX(tx) translateY(ty) scale(s) with origin at center
        // visual = (content - center) * scale + translate + center
        // content = (visual - translate - center) / scale + center
        const s = webScaleRef.current;
        const tx = webTranslateRef.current.x;
        const ty = webTranslateRef.current.y;
        const cw = webContainerSizeRef.current.width || window.innerWidth;
        const ch = webContainerSizeRef.current.height || window.innerHeight;
        const locationX = (visualX - tx - cw / 2) / s + cw / 2;
        const locationY = (visualY - ty - ch / 2) / s + ch / 2;

        onImageTapRef.current({ locationX, locationY });
        webTapRef.current.handled = true; // prevent duplicate from click event
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [visible, lockZoom]);

  // Mouse drag for panning (desktop only, when zoomed in)
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!webDragRef.current.dragging) return;
      const dx = e.clientX - webDragRef.current.lastX;
      const dy = e.clientY - webDragRef.current.lastY;
      webDragRef.current.lastX = e.clientX;
      webDragRef.current.lastY = e.clientY;
      setWebTranslate(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    };
    const onMouseUp = () => { webDragRef.current.dragging = false; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [visible]);

  // Notify parent of web zoom changes
  useEffect(() => {
    if (Platform.OS === 'web' && onZoomChange) {
      onZoomChange({ scale: webScale, positionX: webTranslate.x, positionY: webTranslate.y });
    }
  }, [webScale, webTranslate]);

  const imageAndOverlay = (
    <View
      style={{ width: effectiveSize.width, height: effectiveSize.height }}
      {...(panHandlers || {})}
    >
      <CachedImage
        source={{ uri: photoUrl }}
        style={styles.image}
        contentFit="contain"
      />

      {displayedDimensions.width > 0 && (
        <View
          style={{
            position: 'absolute',
            left: offsetX,
            top: offsetY,
            width: displayedDimensions.width,
            height: displayedDimensions.height,
          }}
          pointerEvents={overlayPointerEvents}
        >
          <RouteOverlay
            handHolds={handHolds}
            footHolds={footHolds}
            detectedHolds={detectedHolds}
            width={displayedDimensions.width}
            height={displayedDimensions.height}
            pointerEvents={overlayPointerEvents}
            resizingHoldIndex={resizingHoldIndex}
            showLabels={showLabels}
            onHandHoldPress={onHandHoldPress}
            selectedHoldId={selectedHoldId}
          />
        </View>
      )}

    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <SafeAreaView style={styles.container}>
        {Platform.OS === 'web' ? (
          <View
            ref={(node: any) => { webZoomRef.current = node; }}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setContainerSize({ width, height });
              webContainerSizeRef.current = { width, height };
              // Capture container viewport position for mobile tap coordinates
              const node = webZoomRef.current;
              if (node) {
                const rect = (node as any).getBoundingClientRect();
                webContainerPosRef.current = { left: rect.left, top: rect.top };
              }
            }}
            // @ts-expect-error - web-only mouse event props
            onMouseDown={(e: any) => {
              if (webScale > 1) {
                webDragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
              }
            }}
            onClick={(e: any) => {
              if (!onImageTap) return;
              // Skip if touch handler already processed this tap (mobile)
              if (webTapRef.current.handled) {
                webTapRef.current.handled = false;
                return;
              }
              // Desktop: convert click to content coordinates
              const rect = e.currentTarget.getBoundingClientRect();
              const visualX = e.clientX - rect.left;
              const visualY = e.clientY - rect.top;
              // Inverse-transform for zoom/pan
              const s = webScale;
              const tx = webTranslate.x;
              const ty = webTranslate.y;
              const cw = containerSize.width || windowDimensions.width;
              const ch = containerSize.height || windowDimensions.height;
              const locationX = (visualX - tx - cw / 2) / s + cw / 2;
              const locationY = (visualY - ty - ch / 2) / s + ch / 2;
              onImageTap({ locationX, locationY });
            }}
            style={[
              styles.webZoomContainer,
              {
                flex: 1,
                // @ts-expect-error - web-only CSS cursor property
                cursor: webScale > 1 ? 'grab' : 'default',
              },
            ]}
          >
            <View
              style={{
                width: effectiveSize.width,
                height: effectiveSize.height,
                transform: [
                  { translateX: webTranslate.x },
                  { translateY: webTranslate.y },
                  { scale: webScale },
                ],
              }}
            >
              {imageAndOverlay}
            </View>
          </View>
        ) : (
          // @ts-expect-error - ImageZoom types don't include children but it accepts them
          <ImageZoom
            cropWidth={windowDimensions.width}
            cropHeight={windowDimensions.height}
            imageWidth={windowDimensions.width}
            imageHeight={windowDimensions.height}
            minScale={1}
            maxScale={lockZoom ? 1 : 4}
            enableSwipeDown={!lockZoom}
            onClick={onImageTap}
            onMove={handleZoomChange}
          >
            {imageAndOverlay}
          </ImageZoom>
        )}

        {/* Header or Close button */}
        {headerTitle ? (
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            {headerRight || (
              <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                <Text style={styles.headerButtonText}>{closeButtonText}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>{closeButtonText}</Text>
          </TouchableOpacity>
        )}

        {/* Helper banner */}
        {helperBanner}

        {/* Additional content (modals, controls, etc.) */}
        {children}
      </SafeAreaView>
    </Modal>
  );
}

// Export shared styles for child components to use
export const baseStyles = StyleSheet.create({
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
  modalButtonCancel: {
    backgroundColor: '#6c757d',
  },
  helperBanner: {
    position: 'absolute',
    top: 110,
    left: 0,
    right: 0,
    backgroundColor: '#0066cc',
    padding: 12,
  },
  helperText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webZoomContainer: {
    overflow: 'hidden',
    // @ts-expect-error - web-only CSS to prevent browser pinch zoom
    touchAction: 'none',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
