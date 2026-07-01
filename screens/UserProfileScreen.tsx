import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { userProfilesApi } from "../lib/api";
import { useThemeColors } from "../lib/theme-context";
import UserLogsList from "../components/UserLogsList";
import BadgeGrid from "../components/BadgeGrid";
import BadgeGlyph from "../components/BadgeGlyph";
import SafeScreen from "../components/SafeScreen";
import { useApiQuery } from "../hooks/useApiQuery";
import { ScreenProps } from "../navigation/types";
import { BADGE_PRESENTATION } from "../lib/badges";
import { BadgeKey } from "../types/database.types";

export default function UserProfileScreen({
  route,
  navigation,
}: ScreenProps<"UserProfile">) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { userId } = route.params;

  const { data: profile, loading } = useApiQuery(
    () => userProfilesApi.get(userId),
    [userId],
  );
  const displayName = profile?.display_name || null;
  const showcaseBadgeKey: BadgeKey | null = profile?.showcase_badge_key ?? null;

  useEffect(() => {
    if (loading) return;
    const name = displayName || t("common.anonymous");
    if (!showcaseBadgeKey) {
      navigation.setOptions({ title: name, headerTitle: undefined });
      return;
    }
    const pres = BADGE_PRESENTATION[showcaseBadgeKey];
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerRow}>
          <BadgeGlyph iconSet={pres.iconSet} icon={pres.icon} color={pres.color} size={18} />
          <Text style={[styles.headerName, { color: colors.textPrimary }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
      ),
    });
  }, [displayName, showcaseBadgeKey, loading, navigation, t, colors]);

  if (loading) {
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

  const header = (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t("badges.title")}
      </Text>
      <BadgeGrid userId={userId} showLocked={false} />
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t("log.title")}
      </Text>
    </View>
  );

  return (
    <SafeScreen>
      <UserLogsList
        userId={userId}
        statuses={["sent"]}
        emptyMessage={t("log.noSendsYet")}
        header={header}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerName: {
    fontSize: 17,
    fontWeight: "600",
    marginLeft: 6,
  },
});
