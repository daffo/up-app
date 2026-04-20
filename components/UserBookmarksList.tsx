import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { AppNavigationProp } from "../navigation/types";
import { bookmarksApi } from "../lib/api";
import { Bookmark } from "../types/database.types";
import { useThemeColors } from "../lib/theme-context";
import { formatRelativeDate } from "../utils/date";
import ListItemWithRoute from "./ListItemWithRoute";
import DataListView from "./DataListView";
import { useApiQuery } from "../hooks/useApiQuery";

type BookmarkWithRoute = Bookmark & {
  route: { id: string; title: string; grade: string };
};

interface UserBookmarksListProps {
  userId: string;
  emptyMessage?: string;
}

export default function UserBookmarksList({
  userId,
  emptyMessage,
}: UserBookmarksListProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const navigation = useNavigation<AppNavigationProp>();
  const {
    data: bookmarks,
    loading,
    refreshing,
    refresh,
  } = useApiQuery(() => bookmarksApi.list(userId), [userId], {
    cacheKey: "bookmarks",
    initialData: [] as BookmarkWithRoute[],
  });

  const renderBookmark = ({ item: bm }: { item: BookmarkWithRoute }) => (
    <ListItemWithRoute
      title={bm.route.title}
      titleStyle={styles.title}
      headerStyle={styles.header}
      metadata={
        <>
          <View style={styles.meta}>
            <Text style={[styles.grade, { color: colors.primary }]}>
              {bm.route.grade}
            </Text>
          </View>
          <Text style={[styles.date, { color: colors.textTertiary }]}>
            {formatRelativeDate(bm.created_at)}
          </Text>
        </>
      }
      onPress={() =>
        navigation.navigate("RouteDetail", { routeId: bm.route.id })
      }
      chevronPosition="inline"
    />
  );

  return (
    <DataListView
      loading={loading}
      data={bookmarks}
      emptyMessage={emptyMessage || t("bookmark.empty")}
      keyExtractor={(item) => item.id}
      renderItem={renderBookmark}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: "500",
  },
  header: {
    marginBottom: 4,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  grade: {
    fontSize: 14,
    fontWeight: "600",
  },
  date: {
    fontSize: 12,
  },
});
