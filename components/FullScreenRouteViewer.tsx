import { HandHold, FootHold, DetectedHold } from '../types/database.types';
import FullScreenImageBase from './FullScreenImageBase';

interface FullScreenRouteViewerProps {
  visible: boolean;
  photoUrl: string;
  handHolds: HandHold[];
  footHolds?: FootHold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  showLabels?: boolean;
}

export default function FullScreenRouteViewer({
  visible,
  photoUrl,
  handHolds,
  footHolds = [],
  detectedHolds,
  onClose,
  showLabels = true,
}: FullScreenRouteViewerProps) {
  return (
    <FullScreenImageBase
      visible={visible}
      photoUrl={photoUrl}
      handHolds={handHolds}
      footHolds={footHolds}
      detectedHolds={detectedHolds}
      onClose={onClose}
      showLabels={showLabels}
      closeButtonText="✕"
    />
  );
}
