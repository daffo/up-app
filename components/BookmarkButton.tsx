import React, { useState } from "react";
import { TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { bookmarksApi } from "../lib/api";
import { useThemeColors } from "../lib/theme-context";
import { useApiQuery } from "../hooks/useApiQuery";

interface BookmarkButtonProps {
  routeId: string;
  userId?: string;
  onLoginRequired: () => void;
  compact?: boolean;
}

export default function BookmarkButton({
  routeId,
  userId,
  onLoginRequired,
  compact,
}: BookmarkButtonProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data: bookmarked } = useApiQuery<boolean>(
    () => bookmarksApi.isBookmarked(userId!, routeId),
    [userId, routeId],
    { cacheKey: "bookmarks", enabled: !!userId, initialData: false },
  );
  const [toggling, setToggling] = useState(false);

  const handlePress = async () => {
    if (!userId) {
      onLoginRequired();
      return;
    }
    if (toggling) return;
    setToggling(true);
    try {
      await bookmarksApi.toggle(userId, routeId);
    } catch (err) {
      console.error("Error toggling bookmark:", err);
    } finally {
      setToggling(false);
    }
  };

  const iconName = bookmarked ? "bookmark" : "bookmark-outline";
  const iconSize = compact ? 20 : 24;
  const color = bookmarked ? colors.primary : colors.textSecondary;
  const label = bookmarked ? t("bookmark.remove") : t("bookmark.add");

  return (
    <TouchableOpacity
      onPress={handlePress}
      accessibilityLabel={label}
      style={compact ? styles.compact : styles.full}
      disabled={toggling}
    >
      {toggling ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={iconName} size={iconSize} color={color} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  compact: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  full: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});
