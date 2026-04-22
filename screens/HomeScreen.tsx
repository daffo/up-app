import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import SafeScreen from "../components/SafeScreen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { RouteFilters, UserRelation } from "../types/database.types";
import RouteList from "../components/RouteList";
import ProfileDropdown from "../components/ProfileDropdown";
import FilterModal from "../components/FilterModal";
import { bookmarksApi, logsApi, routesApi } from "../lib/api";
import { useThemeColors } from "../lib/theme-context";
import { ScreenProps } from "../navigation/types";

const FILTERS_STORAGE_KEY = "route_filters";

const DEFAULT_FILTERS: RouteFilters = { wallActive: true };

export default function HomeScreen({ navigation }: ScreenProps<"Home">) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { user, signOut, requireAuth } = useRequireAuth();
  const [filters, setFilters] = useState<RouteFilters>(DEFAULT_FILTERS);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const prevUserIdRef = useRef<string | undefined>(undefined);

  const wallActive = !!filters.wallActive;
  const wallPast = !!filters.wallPast;
  const relations = filters.userRelations ?? [];

  const hasActiveFilters =
    !!filters.grade ||
    !!filters.search ||
    wallPast ||
    !wallActive ||
    relations.length > 0;

  // Load persisted filters on mount
  useEffect(() => {
    AsyncStorage.getItem(FILTERS_STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setFilters({ ...DEFAULT_FILTERS, ...parsed });
        } catch (e) {
          console.error("Failed to parse stored filters:", e);
        }
      }
      setFiltersLoaded(true);
    });
  }, []);

  // Clear user-specific filters when user changes (login/logout)
  useEffect(() => {
    if (filtersLoaded && prevUserIdRef.current !== user?.id) {
      if (prevUserIdRef.current !== undefined) {
        setFilters((f) => {
          const next = { ...f, userRelations: undefined };
          const { routeIds, ...persistable } = next;
          AsyncStorage.setItem(
            FILTERS_STORAGE_KEY,
            JSON.stringify(persistable),
          );
          return next;
        });
      }
      prevUserIdRef.current = user?.id;
    }
  }, [user?.id, filtersLoaded]);

  // Resolve userRelations → routeIds union. Session-only, not persisted.
  useEffect(() => {
    if (!user || relations.length === 0) {
      setFilters((f) => {
        if (f.routeIds === undefined) return f;
        const { routeIds, ...rest } = f;
        return rest;
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ids = new Set<string>();
        if (relations.includes("created")) {
          const createdIds = await routesApi.listIdsByCreator(user.id);
          createdIds.forEach((id) => ids.add(id));
        }
        if (relations.includes("saved")) {
          const bms = await bookmarksApi.list(user.id);
          bms.forEach((b) => ids.add(b.route.id));
        }
        if (relations.includes("sent")) {
          const logs = await logsApi.listByUser(user.id, ["sent"]);
          logs.forEach((l) => ids.add(l.route.id));
        }
        if (relations.includes("tried")) {
          const logs = await logsApi.listByUser(user.id, ["attempted"]);
          logs.forEach((l) => ids.add(l.route.id));
        }
        if (!cancelled) {
          setFilters((f) => ({ ...f, routeIds: Array.from(ids) }));
        }
      } catch (err) {
        console.error("Error resolving relationship filter:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, JSON.stringify(relations)]);

  // Persist filter changes (minus session-only routeIds)
  const handleApplyFilters = (newFilters: RouteFilters) => {
    setFilters(newFilters);
    const { routeIds, ...persistable } = newFilters;
    AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(persistable));
  };

  const clearRelation = (relation: UserRelation) => {
    handleApplyFilters({
      ...filters,
      userRelations: relations.filter((r) => r !== relation),
    });
  };

  const handleAddRoute = () => {
    requireAuth(
      () => navigation.navigate("CreateEditRoute"),
      "CreateEditRoute",
    );
  };

  const handleRoutePress = (routeId: string) => {
    navigation.navigate("RouteDetail", { routeId });
  };

  const handleLogout = async () => {
    await signOut();
  };

  // Build active-chip list for the bar. Each chip has close-x → clears only
  // that filter. Default state (Active walls only, nothing else) renders no
  // chips.
  const chipRow: Array<{
    key: string;
    label: string;
    a11y: string;
    onClear: () => void;
  }> = [];

  if (filters.search) {
    chipRow.push({
      key: "search",
      label: `"${filters.search}"`,
      a11y: t("filters.clearSearch"),
      onClear: () => handleApplyFilters({ ...filters, search: undefined }),
    });
  }
  if (filters.grade) {
    chipRow.push({
      key: "grade",
      label: `${t("filters.grade")}: ${filters.grade}`,
      a11y: t("filters.clearGrade"),
      onClear: () => handleApplyFilters({ ...filters, grade: undefined }),
    });
  }
  if (wallActive) {
    chipRow.push({
      key: "wall-active",
      label: t("filters.wallActive"),
      a11y: t("filters.wallActive"),
      onClear: () => handleApplyFilters({ ...filters, wallActive: false }),
    });
  }
  if (wallPast) {
    chipRow.push({
      key: "wall-past",
      label: t("filters.wallPast"),
      a11y: t("filters.wallPast"),
      onClear: () => handleApplyFilters({ ...filters, wallPast: false }),
    });
  }
  for (const relation of relations) {
    chipRow.push({
      key: `relation-${relation}`,
      label: t(`filters.${relation}`),
      a11y: t(`filters.${relation}`),
      onClear: () => clearRelation(relation),
    });
  }

  return (
    <SafeScreen hasHeader={false}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.cardBackground,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t("home.title")}
        </Text>
        {user ? (
          <ProfileDropdown
            onSettings={() => navigation.navigate("Settings")}
            onMyLogs={() => navigation.navigate("MyLogs")}
            onMyComments={() => navigation.navigate("MyComments")}
            onAdmin={() => navigation.navigate("AdminPhotos")}
            onLogout={handleLogout}
          />
        ) : (
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.loginText}>{t("home.login")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.contentHeader}>
          <Text style={[styles.subtitle, { color: colors.textPrimary }]}>
            {t("home.sprayWallRoutes")}
          </Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                { backgroundColor: colors.borderLight },
                hasActiveFilters && { backgroundColor: colors.primary },
              ]}
              onPress={() => setFilterModalVisible(true)}
              accessibilityLabel={t("filters.openFilters")}
            >
              <Ionicons
                name="filter"
                size={20}
                color={hasActiveFilters ? "#fff" : colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAddRoute}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {chipRow.length > 0 && (
          <View style={styles.activeFiltersBar}>
            {chipRow.map((chip) => (
              <TouchableOpacity
                key={chip.key}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.primaryLight },
                ]}
                onPress={chip.onClear}
                accessibilityLabel={chip.a11y}
              >
                <Text
                  style={[styles.filterChipText, { color: colors.primary }]}
                >
                  {chip.label}
                </Text>
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {filtersLoaded && (
          <RouteList onRoutePress={handleRoutePress} filters={filters} />
        )}

        <FilterModal
          visible={filterModalVisible}
          filters={filters}
          userId={user?.id}
          onClose={() => setFilterModalVisible(false)}
          onApply={handleApplyFilters}
          onLoginRequired={() =>
            requireAuth(() => setFilterModalVisible(true), "Home")
          }
        />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  loginButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  loginText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  contentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  activeFiltersBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    gap: 6,
  },
  filterChipText: {
    fontSize: 14,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "600",
  },
});
