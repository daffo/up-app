import { useCallback } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useTranslation } from "react-i18next";
import { RouteFilters } from "../types/database.types";
import { routesApi, RouteWithStats } from "../lib/api";
import { useThemeColors } from "../lib/theme-context";
import RouteCard from "./RouteCard";
import { usePaginatedQuery } from "../hooks/usePaginatedQuery";

interface RouteListProps {
  onRoutePress: (routeId: string) => void;
  filters?: RouteFilters;
}

const keyExtractor = (item: RouteWithStats) => item.id;

export default function RouteList({ onRoutePress, filters }: RouteListProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const handleRoutePress = useCallback(
    (routeId: string) => {
      onRoutePress(routeId);
    },
    [onRoutePress],
  );
  const {
    data: routes,
    loading,
    loadingMore,
    error,
    refreshing,
    hasMore,
    refresh,
    loadMore,
  } = usePaginatedQuery(
    (cursor?: { created_at: string; id: string }) =>
      routesApi.list(filters, { cursor }),
    [filters],
    {
      cacheKey: ["routes", "logs"],
      getCursor: (items) => {
        const last = items[items.length - 1];
        return { created_at: last.created_at, id: last.id };
      },
    },
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {t("routes.error", { message: error })}
        </Text>
      </View>
    );
  }

  if (routes.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t("routes.noRoutesYet")}
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
          {t("routes.beFirstToAdd")}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={routes}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => (
        <RouteCard route={item} routeId={item.id} onPress={handleRoutePress} />
      )}
      contentContainerStyle={styles.listContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.1}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator style={styles.footer} color={colors.primary} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
  footer: {
    paddingVertical: 16,
  },
});
