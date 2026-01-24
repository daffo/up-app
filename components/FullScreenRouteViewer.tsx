import { Hold, DetectedHold } from '../types/database.types';
import FullScreenImageBase from './FullScreenImageBase';

interface FullScreenRouteViewerProps {
  visible: boolean;
  photoUrl: string;
  holds: Hold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  showLabels?: boolean;
}

export default function FullScreenRouteViewer({
  visible,
  photoUrl,
  holds,
  detectedHolds,
  onClose,
  showLabels = true,
}: FullScreenRouteViewerProps) {
  return (
    <FullScreenImageBase
      visible={visible}
      photoUrl={photoUrl}
      holds={holds}
      detectedHolds={detectedHolds}
      onClose={onClose}
      showLabels={showLabels}
      closeButtonText="✕"
    />
  );
}
