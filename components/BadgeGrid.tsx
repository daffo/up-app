import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { badgesApi, userProfilesApi, CACHE_EVENTS } from "../lib/api";
import { BADGE_PRESENTATION } from "../lib/badges";
import BadgeGlyph from "./BadgeGlyph";
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

  const {
    data: profile,
    refetch: refetchProfile,
  } = useApiQuery(() => userProfilesApi.get(userId), [userId]);
  const showcaseBadgeKey = profile?.showcase_badge_key ?? null;
  const [showcaseSaving, setShowcaseSaving] = useState(false);

  const earnedMap = useMemo(() => {
    const map = new Map<BadgeKey, string>();
    earned.forEach((b) => map.set(b.badge_key, b.earned_at));
    return map;
  }, [earned]);

  const visible = useMemo(() => {
    if (showLocked) return catalog;
    return catalog.filter((b) => earnedMap.has(b.key));
  }, [catalog, earnedMap, showLocked]);

  const handleToggleShowcase = async () => {
    if (!selected) return;
    setShowcaseSaving(true);
    try {
      const nextKey = showcaseBadgeKey === selected ? null : selected;
      await userProfilesApi.upsert(userId, { showcase_badge_key: nextKey });
      refetchProfile();
    } catch (err) {
      console.error("Failed to update showcase badge:", err);
    } finally {
      setShowcaseSaving(false);
    }
  };

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
                  size={40}
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
        footer={
          showLocked && selectedIsEarned ? (
            <TouchableOpacity
              style={[
                styles.showcaseButton,
                { backgroundColor: colors.primary },
                showcaseSaving && styles.showcaseButtonDisabled,
              ]}
              onPress={handleToggleShowcase}
              disabled={showcaseSaving}
            >
              <Text style={[styles.showcaseButtonText, { color: colors.textOnPrimary }]}>
                {showcaseBadgeKey === selected
                  ? t("badges.removeAsShowcase")
                  : t("badges.setAsShowcase")}
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
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
  showcaseButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  showcaseButtonDisabled: {
    opacity: 0.6,
  },
  showcaseButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
