import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth-context";
import UserLogsList from "../components/UserLogsList";
import SafeScreen from "../components/SafeScreen";
import { LogStatus } from "../types/database.types";
import { useThemeColors } from "../lib/theme-context";

const ALL_STATUSES: LogStatus[] = ["sent", "attempted"];

export default function MyLogsScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<LogStatus>>(new Set());

  if (!user) {
    return <SafeScreen />;
  }

  const toggle = (status: LogStatus) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const statuses = Array.from(selected);
  const emptyMessage =
    selected.size === 1 ? t(`log.empty.${statuses[0]}`) : t("log.emptyList");

  return (
    <SafeScreen>
      <View
        style={[
          styles.pillRow,
          {
            borderBottomColor: colors.separator,
            backgroundColor: colors.cardBackground,
          },
        ]}
      >
        {ALL_STATUSES.map((status) => {
          const active = selected.has(status);
          const labelKey = status === "sent" ? "sent" : "attempted";
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.pill,
                {
                  backgroundColor: active
                    ? colors.primaryLight
                    : colors.borderLight,
                },
              ]}
              onPress={() => toggle(status)}
              accessibilityLabel={t(`log.tab.${labelKey}`)}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: active ? colors.primary : colors.textSecondary },
                ]}
              >
                {t(`log.tab.${labelKey}`)}
              </Text>
              {active && (
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={colors.textSecondary}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      <UserLogsList
        userId={user.id}
        statuses={statuses}
        emptyMessage={emptyMessage}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  pillRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 16,
    gap: 6,
  },
  pillText: {
    fontSize: 14,
  },
});
