import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { badgesApi, CACHE_EVENTS } from "../lib/api";
import { BADGE_PRESENTATION, BadgeIconSet } from "../lib/badges";
import { useThemeColors } from "../lib/theme-context";
import { useApiQuery } from "../hooks/useApiQuery";
import { formatDate } from "../utils/date";
import BottomSheet from "./BottomSheet";
import type { Badge, BadgeKey } from "../types/database.types";

interface BadgeGridProps {
  userId: string;
  /** When true, show the full catalog with greyed-out placeholders for
   * unearned badges. When false, render earned badges only. */
  showLocked: boolean;
}

const ICON_SIZE = 40;

function BadgeGlyph({
  iconSet,
  icon,
  color,
  size = ICON_SIZE,
}: {
  iconSet: BadgeIconSet;
  icon: string;
  color: string;
  size?: number;
}) {
  if (iconSet === "ionicons") {
    return <Ionicons name={icon as any} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={icon as any} size={size} color={color} />;
}

export default function BadgeGrid({ userId, showLocked }: BadgeGridProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [selected, setSelected] = useState<BadgeKey | null>(null);

  const { data: catalog, loading: catalogLoading } = useApiQuery<Badge[]>(
    () => badgesApi.catalog(),
    [],
    { initialData: [] },
  );

  const { data: earned, loading: earnedLoading } = useApiQuery(
    () => badgesApi.listForUser(userId),
    [userId],
    { cacheKey: CACHE_EVENTS.BADGES, initialData: [] },
  );

  const earnedMap = useMemo(() => {
    const map = new Map<BadgeKey, string>();
    earned.forEach((b) => map.set(b.badge_key, b.earned_at));
    return map;
  }, [earned]);

  const visible = useMemo(() => {
    if (showLocked) return catalog;
    return catalog.filter((b) => earnedMap.has(b.key));
  }, [catalog, earnedMap, showLocked]);

  if (catalogLoading || earnedLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (visible.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          {t("badges.empty")}
        </Text>
      </View>
    );
  }

  const selectedEarnedAt = selected ? earnedMap.get(selected) : undefined;
  const selectedIsEarned = selected ? earnedMap.has(selected) : false;

  return (
    <>
      <View style={styles.grid}>
        {visible.map((badge) => {
          const isEarned = earnedMap.has(badge.key);
          const pres = BADGE_PRESENTATION[badge.key];
          const tint = isEarned ? pres.color : colors.textTertiary;
          return (
            <TouchableOpacity
              key={badge.key}
              style={styles.cell}
              onPress={() => setSelected(badge.key)}
              accessibilityLabel={t(`badges.${badge.key}.name`)}
            >
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: isEarned ? pres.color : colors.border,
                    opacity: isEarned ? 1 : 0.5,
                  },
                ]}
              >
                <BadgeGlyph
                  iconSet={pres.iconSet}
                  icon={pres.icon}
                  color={tint}
                />
              </View>
              <Text
                numberOfLines={2}
                style={[
                  styles.name,
                  { color: isEarned ? colors.textPrimary : colors.textTertiary },
                ]}
              >
                {t(`badges.${badge.key}.name`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <BottomSheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? t(`badges.${selected}.name`) : ""}
        closeLabel={t("common.done")}
      >
        {selected && (
          <View>
            <View style={styles.sheetIcon}>
              <BadgeGlyph
                iconSet={BADGE_PRESENTATION[selected].iconSet}
                icon={BADGE_PRESENTATION[selected].icon}
                color={
                  selectedIsEarned
                    ? BADGE_PRESENTATION[selected].color
                    : colors.textTertiary
                }
                size={64}
              />
            </View>
            <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
              {t(`badges.${selected}.desc`)}
            </Text>
            <Text style={[styles.sheetStatus, { color: colors.textTertiary }]}>
              {selectedIsEarned && selectedEarnedAt
                ? t("badges.earnedOn", { date: formatDate(selectedEarnedAt) })
                : t("badges.locked")}
            </Text>
          </View>
        )}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    fontSize: 14,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
  },
  cell: {
    width: "33.333%",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  name: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  sheetIcon: {
    alignItems: "center",
    marginBottom: 16,
  },
  sheetDesc: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 12,
  },
  sheetStatus: {
    fontSize: 13,
    textAlign: "center",
  },
});
