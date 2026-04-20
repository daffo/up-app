import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { AppNavigationProp } from "../navigation/types";
import { logsApi } from "../lib/api";
import { Log, LogStatus } from "../types/database.types";
import { useThemeColors } from "../lib/theme-context";
import { formatRelativeDate } from "../utils/date";
import { getDifficultyLabel } from "../utils/sends";
import ListItemWithRoute from "./ListItemWithRoute";
import DataListView from "./DataListView";
import { useApiQuery } from "../hooks/useApiQuery";

type LogWithRoute = Log & {
  route: { id: string; title: string; grade: string };
};

interface UserLogsListProps {
  userId: string;
  status?: LogStatus;
  emptyMessage?: string;
}

export default function UserLogsList({
  userId,
  status,
  emptyMessage,
}: UserLogsListProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const navigation = useNavigation<AppNavigationProp>();
  const {
    data: logs,
    loading,
    refreshing,
    refresh,
  } = useApiQuery(() => logsApi.listByUser(userId, status), [userId, status], {
    cacheKey: "logs",
    initialData: [] as LogWithRoute[],
  });

  const renderLog = ({ item: log }: { item: LogWithRoute }) => (
    <ListItemWithRoute
      title={log.route.title}
      titleStyle={styles.logTitle}
      headerStyle={styles.logHeader}
      metadata={
        <>
          <View style={styles.logMeta}>
            <Text style={[styles.logGrade, { color: colors.primary }]}>
              {log.route.grade}
            </Text>
            <Text
              style={[
                styles.logBadge,
                log.status === "sent"
                  ? { color: colors.success }
                  : { color: colors.warning },
              ]}
            >
              {t(`log.badge${log.status === "sent" ? "Sent" : "Attempted"}`)}
            </Text>
            {log.quality_rating && (
              <View style={styles.logRating}>
                <Ionicons name="star" size={12} color={colors.star} />
                <Text
                  style={[
                    styles.logRatingText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {log.quality_rating}
                </Text>
              </View>
            )}
            {log.status === "sent" && log.difficulty_rating !== null && (
              <Text
                style={[styles.logDifficulty, { color: colors.textSecondary }]}
              >
                {getDifficultyLabel(log.difficulty_rating)}
              </Text>
            )}
          </View>
          <Text style={[styles.logDate, { color: colors.textTertiary }]}>
            {formatRelativeDate(log.logged_at)}
          </Text>
        </>
      }
      onPress={() =>
        navigation.navigate("RouteDetail", { routeId: log.route.id })
      }
      chevronPosition="inline"
    />
  );

  return (
    <DataListView
      loading={loading}
      data={logs}
      emptyMessage={emptyMessage || t("log.emptyList")}
      keyExtractor={(item) => item.id}
      renderItem={renderLog}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
  logTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  logHeader: {
    marginBottom: 4,
  },
  logMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  logGrade: {
    fontSize: 14,
    fontWeight: "600",
  },
  logBadge: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  logRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  logRatingText: {
    fontSize: 12,
  },
  logDifficulty: {
    fontSize: 12,
  },
  logDate: {
    fontSize: 12,
  },
});
