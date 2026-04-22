import { useState, useEffect } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { HandHold, FootHold, DetectedHold } from "../types/database.types";
import FullScreenImageBase from "./FullScreenImageBase";

interface FullScreenRouteViewerProps {
  visible: boolean;
  photoUrl: string;
  handHolds: HandHold[];
  footHolds?: FootHold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  showLabels?: boolean;
  /** Map of detected_hold_id → attempt count. CTA renders when any entries. */
  triesByHoldId?: Record<string, number>;
}

export default function FullScreenRouteViewer({
  visible,
  photoUrl,
  handHolds,
  footHolds = [],
  detectedHolds,
  onClose,
  showLabels = true,
  triesByHoldId,
}: FullScreenRouteViewerProps) {
  const { t } = useTranslation();
  const [showTries, setShowTries] = useState(false);

  useEffect(() => {
    if (!visible) setShowTries(false);
  }, [visible]);

  const hasTries = !!triesByHoldId && Object.keys(triesByHoldId).length > 0;

  const triesAction = hasTries ? (
    <TouchableOpacity
      style={[styles.triesButton, showTries && styles.triesButtonActive]}
      onPress={() => setShowTries((s) => !s)}
      accessibilityLabel={showTries ? t("log.hideTries") : t("log.showTries")}
    >
      <Text style={styles.triesButtonText}>
        {showTries ? t("log.hideTries") : t("log.showTries")}
      </Text>
    </TouchableOpacity>
  ) : undefined;

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
      topRightAction={triesAction}
      triesByHoldId={showTries ? triesByHoldId : undefined}
    />
  );
}

const styles = StyleSheet.create({
  triesButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  triesButtonActive: {
    backgroundColor: "rgba(220, 53, 69, 0.85)",
  },
  triesButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
