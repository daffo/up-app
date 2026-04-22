import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Keyboard,
  Platform,
  Share,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Database, Log } from "../types/database.types";
import { routesApi, logsApi } from "../lib/api";
import { useUserProfiles } from "../hooks/useUserProfiles";
import RouteVisualization from "../components/RouteVisualization";
import LogButton from "../components/LogButton";
import BookmarkButton from "../components/BookmarkButton";
import CommentsSection from "../components/CommentsSection";
import UserNameLink from "../components/UserNameLink";
import { useRequireAuth } from "../hooks/useRequireAuth";
import { useThemeColors } from "../lib/theme-context";
import { formatDate } from "../utils/date";
import SafeScreen from "../components/SafeScreen";
import DraftBanner from "../components/DraftBanner";
import { useApiQuery } from "../hooks/useApiQuery";
import { ScreenProps } from "../navigation/types";
import { setPendingFallHoldCallback } from "../lib/fall-hold-picker-bus";

type Route = Database["public"]["Tables"]["routes"]["Row"];
type Photo = Database["public"]["Tables"]["photos"]["Row"];

interface RouteWithPhoto extends Route {
  photo?: Photo;
}

export default function RouteDetailScreen({
  route,
  navigation,
}: ScreenProps<"RouteDetail">) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { routeId } = route.params;
  const { user, requireAuth } = useRequireAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const {
    data: routeDetail,
    loading,
    error,
  } = useApiQuery(() => routesApi.getWithDetails(routeId), [routeId], {
    cacheKey: "route",
  });

  const { profileMap } = useUserProfiles([routeDetail?.route?.user_id]);

  const { data: logs } = useApiQuery(
    () => logsApi.listByRoute(routeId),
    [routeId],
    { cacheKey: "logs", initialData: [] as Log[] },
  );

  const routeData = routeDetail?.route ?? null;
  const detectedHolds = routeDetail?.detectedHolds ?? [];
  const triesByHoldId = logs.reduce<Record<string, number>>((acc, l) => {
    if (l.status === "attempted" && l.fall_hold_id) {
      acc[l.fall_hold_id] = (acc[l.fall_hold_id] ?? 0) + 1;
    }
    return acc;
  }, {});

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleShare = async () => {
    const title = routeData?.title ?? "";
    const grade = routeData?.grade ?? "";
    const message = t("route.shareMessage", {
      title,
      grade,
      url: `https://up-app-one.vercel.app/route/${routeId}`,
    });
    await Share.share({ message });
  };

  const [publishing, setPublishing] = useState(false);

  const handlePublish = async () => {
    try {
      setPublishing(true);
      await routesApi.update(routeId, { is_draft: false });
      Alert.alert(t("common.success"), t("routeForm.routePublished"));
    } catch (err) {
      console.error("Error publishing route:", err);
      Alert.alert(t("common.error"), t("routeForm.errorSave"));
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        routeData && !routeData.is_draft ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginRight: 10,
            }}
          >
            <BookmarkButton
              routeId={routeId}
              userId={user?.id}
              onLoginRequired={() => requireAuth(() => {}, "RouteDetail")}
              compact
            />
            <LogButton
              routeId={routeId}
              userId={user?.id}
              onLoginRequired={() => requireAuth(() => {}, "RouteDetail")}
              compact
              onPickFallHold={(current, onPicked) => {
                setPendingFallHoldCallback(onPicked);
                navigation.navigate("FallHoldPicker", {
                  routeId,
                  currentFallHoldId: current,
                });
              }}
            />
          </View>
        ) : null,
    });
  }, [user, navigation, routeId, requireAuth, routeData]);

  if (loading) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: colors.screenBackground },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !routeData) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: colors.screenBackground },
        ]}
      >
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {error || "Route not found"}
        </Text>
      </View>
    );
  }

  return (
    <SafeScreen>
      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, { backgroundColor: colors.screenBackground }]}
        contentContainerStyle={{ paddingBottom: keyboardHeight }}
        keyboardShouldPersistTaps="handled"
      >
        {routeData.is_draft && user && routeData.user_id === user.id && (
          <DraftBanner onPublish={handlePublish} publishing={publishing} />
        )}

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
            {routeData.title}
          </Text>
          <View style={styles.headerMeta}>
            <Text style={[styles.grade, { color: colors.primary }]}>
              {routeData.grade}
            </Text>
            <Text style={[styles.holdCount, { color: colors.textSecondary }]}>
              {t("route.holds", { count: routeData.holds.hand_holds.length })}
            </Text>
          </View>
          {routeData.description && (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {routeData.description}
            </Text>
          )}
        </View>

        {routeData.photo && (
          <View
            style={[
              styles.imageSection,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.border,
              },
            ]}
          >
            <RouteVisualization
              photoUrl={routeData.photo.image_url}
              handHolds={routeData.holds.hand_holds}
              footHolds={routeData.holds.foot_holds}
              detectedHolds={detectedHolds}
              triesByHoldId={triesByHoldId}
            />
          </View>
        )}

        <View
          style={[
            styles.detailsSection,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[styles.detailRow, { borderBottomColor: colors.separator }]}
          >
            <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>
              {t("route.createdBy")}
            </Text>
            <UserNameLink
              userId={routeData.user_id}
              displayName={profileMap[routeData.user_id]}
              style={[styles.detailValue, { color: colors.textSecondary }]}
            />
          </View>
          <View
            style={[styles.detailRow, { borderBottomColor: colors.separator }]}
          >
            <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>
              {t("route.created")}
            </Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
              {formatDate(routeData.created_at)}
            </Text>
          </View>
          {!routeData.is_draft && (
            <TouchableOpacity
              style={[
                styles.detailRow,
                { borderBottomColor: colors.separator },
              ]}
              onPress={() => navigation.navigate("RouteSends", { routeId })}
            >
              <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>
                {t("route.rating")}
              </Text>
              <View style={styles.ratingValue}>
                {(() => {
                  const ratings = logs
                    .map((l) => l.quality_rating)
                    .filter((r): r is number => r !== null);
                  const avg =
                    ratings.length > 0
                      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
                      : null;
                  const sendCount = logs.filter(
                    (l) => l.status === "sent",
                  ).length;
                  return avg !== null ? (
                    <>
                      <Ionicons name="star" size={16} color={colors.star} />
                      <Text style={[styles.ratingText, { color: colors.star }]}>
                        {avg.toFixed(1)}
                      </Text>
                      <Text
                        style={[
                          styles.sendCountText,
                          { color: colors.textTertiary },
                        ]}
                      >
                        ({sendCount})
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={[
                        styles.detailValue,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t("route.noRatingsYet")}
                    </Text>
                  );
                })()}
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textTertiary}
                  style={styles.chevron}
                />
              </View>
            </TouchableOpacity>
          )}
          {!routeData.is_draft && (
            <TouchableOpacity
              style={[
                styles.detailRow,
                !(user && routeData.user_id === user.id) &&
                  styles.detailRowLast,
                { borderBottomColor: colors.separator },
              ]}
              onPress={handleShare}
              accessibilityLabel={t("route.share")}
            >
              <Text style={[styles.editRouteLabel, { color: colors.primary }]}>
                {t("route.share")}
              </Text>
              <Ionicons name="share-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          {user && routeData.user_id === user.id && (
            <TouchableOpacity
              style={[
                styles.detailRow,
                styles.detailRowLast,
                { borderBottomColor: colors.separator },
              ]}
              onPress={() =>
                navigation.navigate("CreateEditRoute", { routeId })
              }
            >
              <Text style={[styles.editRouteLabel, { color: colors.primary }]}>
                {t("route.editRoute")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        {!routeData.is_draft && (
          <CommentsSection
            routeId={routeId}
            userId={user?.id}
            onLoginRequired={() => requireAuth(() => {}, "RouteDetail")}
            onInputFocus={() => {
              setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }, 300);
            }}
          />
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  grade: {
    fontSize: 18,
    fontWeight: "600",
  },
  holdCount: {
    fontSize: 14,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  imageSection: {
    marginTop: 12,
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  detailsSection: {
    marginTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 15,
  },
  detailValue: {
    fontSize: 15,
  },
  ratingValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 15,
    fontWeight: "600",
  },
  sendCountText: {
    fontSize: 14,
  },
  chevron: {
    marginLeft: 4,
  },
  editRouteLabel: {
    fontSize: 15,
  },
});
