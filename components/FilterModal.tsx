import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { RouteFilters, UserRelation } from "../types/database.types";
import { useThemeColors } from "../lib/theme-context";
import TrimmedTextInput from "./TrimmedTextInput";
import BottomSheet from "./BottomSheet";

interface FilterModalProps {
  visible: boolean;
  filters: RouteFilters;
  userId?: string;
  onClose: () => void;
  onApply: (filters: RouteFilters) => void;
  onLoginRequired: () => void;
}

const RELATIONS: UserRelation[] = ["created", "saved", "tried", "sent"];

export default function FilterModal({
  visible,
  filters,
  userId,
  onClose,
  onApply,
  onLoginRequired,
}: FilterModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const handleSearchChange = (text: string) => {
    onApply({ ...filters, search: text || undefined });
  };

  const handleGradeChange = (text: string) => {
    onApply({ ...filters, grade: text || undefined });
  };

  const toggleWall = (kind: "active" | "past") => {
    const key = kind === "active" ? "wallActive" : "wallPast";
    onApply({ ...filters, [key]: !filters[key] });
  };

  const toggleRelation = (relation: UserRelation) => {
    if (!userId) {
      onClose();
      onLoginRequired();
      return;
    }
    const current = filters.userRelations ?? [];
    const next = current.includes(relation)
      ? current.filter((r) => r !== relation)
      : [...current, relation];
    onApply({
      ...filters,
      userRelations: next.length > 0 ? next : undefined,
    });
  };

  const handleReset = () => {
    onApply({ wallActive: true });
  };

  const wallActive = !!filters.wallActive;
  const wallPast = !!filters.wallPast;
  const relations = new Set<UserRelation>(filters.userRelations ?? []);

  const hasActiveFilters =
    !!filters.grade ||
    !!filters.search ||
    wallPast ||
    !wallActive ||
    relations.size > 0;

  const pillStyle = (active: boolean) => [
    styles.pill,
    { borderColor: active ? colors.primary : colors.border },
    active && { backgroundColor: colors.primaryLight },
  ];
  const pillTextStyle = (active: boolean) => [
    styles.pillText,
    { color: active ? colors.primary : colors.textSecondary },
    active && styles.pillTextActive,
  ];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t("filters.title")}
      closeLabel={t("common.done")}
      sheetStyle={filterSheetStyle}
      footer={
        hasActiveFilters ? (
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={[styles.resetButtonText, { color: colors.danger }]}>
              {t("filters.resetFilters")}
            </Text>
          </TouchableOpacity>
        ) : undefined
      }
    >
      <View style={styles.searchRow}>
        <TrimmedTextInput
          style={[
            styles.searchInput,
            {
              borderColor: colors.border,
              color: colors.textPrimary,
              backgroundColor: colors.inputBackground,
            },
          ]}
          value={filters.search || ""}
          onChangeText={handleSearchChange}
          placeholder={t("filters.searchPlaceholder")}
          placeholderTextColor={colors.placeholderText}
          autoCorrect={false}
          accessibilityLabel={t("filters.searchPlaceholder")}
        />
      </View>

      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: colors.textPrimary }]}>
          {t("filters.grade")}
        </Text>
        <TrimmedTextInput
          style={[
            styles.gradeInput,
            {
              borderColor: colors.border,
              color: colors.textPrimary,
              backgroundColor: colors.inputBackground,
            },
          ]}
          value={filters.grade || ""}
          onChangeText={handleGradeChange}
          placeholder={t("filters.gradePlaceholder")}
          placeholderTextColor={colors.placeholderText}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t("filters.grade")}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
        {t("filters.wall")}
      </Text>
      <View style={styles.pillRow}>
        <TouchableOpacity
          style={pillStyle(wallActive)}
          onPress={() => toggleWall("active")}
          accessibilityLabel={t("filters.wallActive")}
        >
          <Text style={pillTextStyle(wallActive)}>
            {t("filters.wallActive")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={pillStyle(wallPast)}
          onPress={() => toggleWall("past")}
          accessibilityLabel={t("filters.wallPast")}
        >
          <Text style={pillTextStyle(wallPast)}>{t("filters.wallPast")}</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
        {t("filters.mine")}
      </Text>
      <View style={styles.pillRow}>
        {RELATIONS.map((relation) => {
          const active = relations.has(relation);
          return (
            <TouchableOpacity
              key={relation}
              style={pillStyle(active)}
              onPress={() => toggleRelation(relation)}
              accessibilityLabel={t(`filters.${relation}`)}
            >
              <Text style={pillTextStyle(active)}>
                {t(`filters.${relation}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const filterSheetStyle = { minHeight: 320 } as const;

const styles = StyleSheet.create({
  searchRow: {
    paddingVertical: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  filterLabel: {
    fontSize: 16,
  },
  gradeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 120,
    textAlign: "right",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 14,
  },
  pillTextActive: {
    fontWeight: "600",
  },
  resetButton: {
    padding: 12,
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: 16,
  },
});
