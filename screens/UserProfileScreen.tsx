import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { userProfilesApi } from "../lib/api";
import { useThemeColors } from "../lib/theme-context";
import UserLogsList from "../components/UserLogsList";
import SafeScreen from "../components/SafeScreen";
import { useApiQuery } from "../hooks/useApiQuery";
import { ScreenProps } from "../navigation/types";

export default function UserProfileScreen({
  route,
  navigation,
}: ScreenProps<"UserProfile">) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { userId } = route.params;

  const { data: displayName, loading } = useApiQuery(async () => {
    const profile = await userProfilesApi.get(userId);
    return profile?.display_name || null;
  }, [userId]);

  useEffect(() => {
    if (!loading) {
      navigation.setOptions({ title: displayName || t("common.anonymous") });
    }
  }, [displayName, loading, navigation, t]);

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

  return (
    <SafeScreen>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t("log.title")}
      </Text>
      <UserLogsList
        userId={userId}
        statuses={["sent"]}
        emptyMessage={t("log.noSendsYet")}
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
});
