import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BADGE_PRESENTATION } from "../lib/badges";
import { useThemeColors } from "../lib/theme-context";
import { useBadgeUnlock } from "../hooks/useBadgeUnlock";

const VISIBLE_MS = 3500;

export default function BadgeUnlockToast() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { current, dismiss } = useBadgeUnlock();
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (current === null) return;

    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 8,
    }).start();

    timerRef.current = setTimeout(() => {
      Animated.timing(translateY, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }).start(() => dismiss());
    }, VISIBLE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, translateY, dismiss]);

  if (current === null) return null;

  const pres = BADGE_PRESENTATION[current];

  const handlePress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(translateY, {
      toValue: -120,
      duration: 200,
      useNativeDriver: true,
    }).start(() => dismiss());
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrapper, { top: insets.top + 8, transform: [{ translateY }] }]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        accessibilityLabel={t("badges.unlocked", { name: t(`badges.${current}.name`) })}
        style={[
          styles.toast,
          {
            backgroundColor: colors.cardBackground,
            borderColor: pres.color,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        <View style={[styles.iconCircle, { borderColor: pres.color }]}>
          {pres.iconSet === "ionicons" ? (
            <Ionicons name={pres.icon as any} size={28} color={pres.color} />
          ) : (
            <MaterialCommunityIcons
              name={pres.icon as any}
              size={28}
              color={pres.color}
            />
          )}
        </View>
        <View style={styles.textBlock}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t("badges.unlockedLabel")}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.name, { color: colors.textPrimary }]}
          >
            {t(`badges.${current}.name`)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    maxWidth: "92%",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textBlock: {
    flexShrink: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
  },
});
