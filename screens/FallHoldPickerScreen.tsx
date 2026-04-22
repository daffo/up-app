import { useState, useEffect, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useTranslation } from "react-i18next";
import { routesApi } from "../lib/api";
import { DetectedHold, HandHold, FootHold } from "../types/database.types";
import FullScreenImageBase, {
  ImageDimensions,
} from "../components/FullScreenImageBase";
import { ScreenProps } from "../navigation/types";
import {
  resolvePendingFallHoldCallback,
  clearPendingFallHoldCallback,
} from "../lib/fall-hold-picker-bus";
import { useThemeColors } from "../lib/theme-context";
import { findSmallestPolygonAtPoint } from "../utils/polygon";

export default function FallHoldPickerScreen({
  route,
  navigation,
}: ScreenProps<"FallHoldPicker">) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { routeId, currentFallHoldId } = route.params;

  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [handHolds, setHandHolds] = useState<HandHold[]>([]);
  const [footHolds, setFootHolds] = useState<FootHold[]>([]);
  const [detectedHolds, setDetectedHolds] = useState<DetectedHold[]>([]);
  const [selectedHoldId, setSelectedHoldId] = useState<string | null>(
    currentFallHoldId,
  );
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions>({
    width: 0,
    height: 0,
  });
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { route: r, detectedHolds: dh } =
          await routesApi.getWithDetails(routeId);
        if (cancelled) return;
        if (r?.photo) {
          setPhotoUrl(r.photo.image_url);
          setHandHolds(r.holds.hand_holds);
          setFootHolds(r.holds.foot_holds);
          setDetectedHolds(dh);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  const confirmSelection = () => {
    resolvePendingFallHoldCallback(selectedHoldId);
    navigation.goBack();
  };

  const cancel = () => {
    // Leave pending callback intact — caller kept its previous value
    clearPendingFallHoldCallback();
    navigation.goBack();
  };

  const clearSelection = () => {
    resolvePendingFallHoldCallback(null);
    navigation.goBack();
  };

  const handleImageTap = (event: any) => {
    if (imageDimensions.width === 0) return;
    const { locationX, locationY } = event;
    const imageX = locationX - imageOffset.x;
    const imageY = locationY - imageOffset.y;
    if (
      imageX < 0 ||
      imageX > imageDimensions.width ||
      imageY < 0 ||
      imageY > imageDimensions.height
    ) {
      return;
    }
    const xPercent = (imageX / imageDimensions.width) * 100;
    const yPercent = (imageY / imageDimensions.height) * 100;

    const routeHoldIds = new Set<string>([
      ...handHolds.map((h) => h.detected_hold_id),
      ...footHolds.map((f) => f.detected_hold_id),
    ]);
    const eligible = detectedHolds.filter((dh) => routeHoldIds.has(dh.id));
    const tapped = findSmallestPolygonAtPoint(xPercent, yPercent, eligible);
    if (tapped) {
      setSelectedHoldId(tapped.id === selectedHoldId ? null : tapped.id);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  if (loading || !photoUrl) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.screenBackground },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FullScreenImageBase
      visible
      photoUrl={photoUrl}
      handHolds={handHolds}
      footHolds={footHolds}
      detectedHolds={detectedHolds}
      onClose={cancel}
      showLabels
      selectedHoldId={selectedHoldId}
      overlayPointerEvents="none"
      onImageTap={handleImageTap}
      onDimensionsReady={(dim, off) => {
        setImageDimensions(dim);
        setImageOffset(off);
      }}
      helperBanner={
        <View style={styles.helperBanner}>
          <Text style={styles.helperText}>{t("log.fallHoldHelper")}</Text>
        </View>
      }
    >
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={clearSelection}>
          <Text style={styles.actionText}>{t("log.fallHoldSkip")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.confirmButton,
            !selectedHoldId && styles.confirmButtonDisabled,
          ]}
          onPress={confirmSelection}
          disabled={!selectedHoldId}
        >
          <Text style={[styles.actionText, styles.confirmText]}>
            {t("log.fallHoldConfirm")}
          </Text>
        </TouchableOpacity>
      </View>
    </FullScreenImageBase>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  helperBanner: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    zIndex: 10,
  },
  helperText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },
  actions: {
    position: "absolute",
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  confirmButton: {
    backgroundColor: "#007AFF",
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  confirmText: {
    color: "#fff",
  },
});
