import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { logsApi } from "../lib/api";
import { Log } from "../types/database.types";
import { useThemeColors } from "../lib/theme-context";
import UserNameLink from "../components/UserNameLink";
import { formatRelativeDate } from "../utils/date";
import { getDifficultyLabel } from "../utils/sends";
import SafeScreen from "../components/SafeScreen";
import ListItemWithRoute from "../components/ListItemWithRoute";
import DataListView from "../components/DataListView";
import { useApiQuery } from "../hooks/useApiQuery";
import { useUserProfiles } from "../hooks/useUserProfiles";
import { ScreenProps } from "../navigation/types";

export default function RouteSendsScreen({ route }: ScreenProps<"RouteSends">) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { routeId } = route.params;

  const {
    data: logs,
    loading,
    refreshing,
    refresh,
  } = useApiQuery(() => logsApi.listByRoute(routeId, "sent"), [routeId], {
    cacheKey: "logs",
    initialData: [] as Log[],
  });

  const { profileMap } = useUserProfiles(logs.map((l) => l.user_id));

  const renderSend = ({ item: log }: { item: Log }) => (
    <ListItemWithRoute
      title=""
      header={
        <View style={styles.sendHeader}>
          <UserNameLink
            userId={log.user_id}
            displayName={profileMap[log.user_id]}
            style={[styles.sendUser, { color: colors.textPrimary }]}
          />
          <Text style={[styles.sendDate, { color: colors.textTertiary }]}>
            {formatRelativeDate(log.logged_at)}
          </Text>
        </View>
      }
      metadata={
        <View style={styles.sendRatings}>
          {log.quality_rating && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={14} color={colors.star} />
              <Text
                style={[styles.ratingText, { color: colors.textSecondary }]}
              >
                {log.quality_rating}
              </Text>
            </View>
          )}
          {log.difficulty_rating !== null && (
            <View
              style={[
                styles.difficultyBadge,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Text style={[styles.difficultyText, { color: colors.primary }]}>
                {getDifficultyLabel(log.difficulty_rating)}
              </Text>
            </View>
          )}
        </View>
      }
    />
  );

  return (
    <SafeScreen>
      <DataListView
        loading={loading}
        data={logs}
        emptyMessage={t("sends.noSendsYet")}
        keyExtractor={(item) => item.id}
        renderItem={renderSend}
        loadingStyle={{ backgroundColor: colors.screenBackground }}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  sendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sendUser: {
    fontSize: 15,
    fontWeight: "600",
  },
  sendDate: {
    fontSize: 12,
  },
  sendRatings: {
    flexDirection: "row",
    gap: 12,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  difficultyText: {
    fontSize: 12,
  },
});
