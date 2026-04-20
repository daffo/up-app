import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth-context";
import UserLogsList from "../components/UserLogsList";
import SafeScreen from "../components/SafeScreen";
import { LogStatus } from "../types/database.types";
import { useThemeColors } from "../lib/theme-context";

type Tab = LogStatus;

export default function MyLogsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("sent");

  if (!user) {
    return <SafeScreen />;
  }

  return (
    <SafeScreen>
      <View
        style={[
          styles.tabs,
          {
            borderBottomColor: colors.separator,
            backgroundColor: colors.cardBackground,
          },
        ]}
      >
        {(["sent", "attempted"] as Tab[]).map((key) => {
          const active = tab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.tab,
                active && { borderBottomColor: colors.primary },
              ]}
              onPress={() => setTab(key)}
              accessibilityLabel={t(`log.tab.${key}`)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? colors.primary : colors.textSecondary },
                  active && styles.tabLabelActive,
                ]}
              >
                {t(`log.tab.${key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <UserLogsList
        userId={user.id}
        status={tab}
        emptyMessage={t(`log.empty.${tab}`)}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: {
    fontSize: 15,
  },
  tabLabelActive: {
    fontWeight: "600",
  },
});
