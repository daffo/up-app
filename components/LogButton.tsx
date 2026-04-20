import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { logsApi } from "../lib/api";
import { Log, LogStatus } from "../types/database.types";
import { useThemeColors } from "../lib/theme-context";
import { useApiQuery } from "../hooks/useApiQuery";
import BottomSheet from "./BottomSheet";

interface LogButtonProps {
  routeId: string;
  userId?: string;
  onLoginRequired: () => void;
  compact?: boolean;
  onPickFallHold?: (
    currentFallHoldId: string | null,
    onPicked: (id: string | null) => void,
  ) => void;
}

export default function LogButton({
  routeId,
  userId,
  onLoginRequired,
  compact,
  onPickFallHold,
}: LogButtonProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data: log, loading } = useApiQuery<Log | null>(
    () => logsApi.getByUserAndRoute(userId!, routeId),
    [userId, routeId],
    { cacheKey: "logs", enabled: !!userId },
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [status, setStatus] = useState<LogStatus>("sent");
  const [qualityRating, setQualityRating] = useState<number | null>(null);
  const [difficultyRating, setDifficultyRating] = useState<number | null>(null);
  const [fallHoldId, setFallHoldId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const DIFFICULTY_OPTIONS = [
    { value: -1, label: t("sends.soft") },
    { value: 0, label: t("sends.accurate") },
    { value: 1, label: t("sends.hard") },
  ];

  useEffect(() => {
    if (log && !modalVisible) {
      setStatus(log.status);
      setQualityRating(log.quality_rating);
      setDifficultyRating(log.difficulty_rating);
      setFallHoldId(log.fall_hold_id);
    }
  }, [log, modalVisible]);

  const handlePress = () => {
    if (!userId) {
      onLoginRequired();
      return;
    }
    setModalVisible(true);
  };

  const handleStatusChange = (next: LogStatus) => {
    setStatus(next);
    // Clear the conflicting field when flipping status
    if (next === "sent") setFallHoldId(null);
    else setDifficultyRating(null);
  };

  const handlePickFallHold = () => {
    if (!onPickFallHold) return;
    onPickFallHold(fallHoldId, (picked) => setFallHoldId(picked));
  };

  const handleSave = async () => {
    if (!userId) return;
    if (qualityRating !== null && (qualityRating < 1 || qualityRating > 5)) {
      Alert.alert(t("common.error"), t("sends.errorQualityRange"));
      return;
    }
    if (
      status === "sent" &&
      difficultyRating !== null &&
      (difficultyRating < -1 || difficultyRating > 1)
    ) {
      Alert.alert(t("common.error"), t("sends.errorDifficultyRange"));
      return;
    }

    setSaving(true);
    try {
      await logsApi.upsert({
        user_id: userId,
        route_id: routeId,
        status,
        quality_rating: qualityRating,
        difficulty_rating: status === "sent" ? difficultyRating : null,
        fall_hold_id: status === "attempted" ? fallHoldId : null,
      });
      setModalVisible(false);
    } catch (err) {
      console.error("Error saving log:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!userId || !log) return;
    setSaving(true);
    try {
      await logsApi.delete(userId, routeId);
      setStatus("sent");
      setQualityRating(null);
      setDifficultyRating(null);
      setFallHoldId(null);
      setModalVisible(false);
    } catch (err) {
      console.error("Error removing log:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const hasLog = !!log;
  const badgeLabel = hasLog
    ? log.status === "sent"
      ? t("log.badgeSent")
      : t("log.badgeAttempted")
    : null;
  const ctaLabel = hasLog ? t("log.edit") : t("log.log");
  const ctaIcon =
    hasLog && log.status === "sent"
      ? "checkmark-circle"
      : hasLog && log.status === "attempted"
        ? "flag"
        : "create-outline";

  return (
    <>
      {compact ? (
        <TouchableOpacity onPress={handlePress} style={styles.compactButton}>
          <Ionicons
            name={ctaIcon}
            size={18}
            color={hasLog ? colors.success : colors.primary}
          />
          <Text
            style={[
              styles.compactText,
              { color: hasLog ? colors.success : colors.primary },
            ]}
          >
            {badgeLabel ?? ctaLabel}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.button,
            {
              borderColor: colors.primary,
              backgroundColor: colors.cardBackground,
            },
            hasLog && { backgroundColor: colors.primary },
          ]}
          onPress={handlePress}
        >
          <Ionicons
            name={ctaIcon}
            size={20}
            color={hasLog ? "#fff" : colors.primary}
          />
          <Text
            style={[
              styles.buttonText,
              { color: colors.primary },
              hasLog && styles.buttonTextOnFilled,
            ]}
          >
            {ctaLabel}
          </Text>
        </TouchableOpacity>
      )}

      <BottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={hasLog ? t("log.edit") : t("log.log")}
        closeLabel={t("common.cancel")}
        closeLabelColor={colors.textSecondary}
        footer={
          <View style={styles.footerButtons}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                saving && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {hasLog ? t("common.update") : t("log.log")}
              </Text>
            </TouchableOpacity>

            {hasLog && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={handleRemove}
                disabled={saving}
              >
                <Text
                  style={[styles.removeButtonText, { color: colors.danger }]}
                >
                  {t("log.remove")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      >
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {t("log.statusLabel")}
        </Text>
        <View style={styles.statusRow}>
          {(["sent", "attempted"] as LogStatus[]).map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.statusOption,
                { borderColor: colors.border },
                status === option && {
                  borderColor: colors.primary,
                  backgroundColor: colors.primaryLight,
                },
              ]}
              onPress={() => handleStatusChange(option)}
              accessibilityLabel={t(`log.status.${option}`)}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: colors.textSecondary },
                  status === option && {
                    color: colors.primary,
                    fontWeight: "600",
                  },
                ]}
              >
                {t(`log.status.${option}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
          {t("sends.qualityRating")}
        </Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() =>
                setQualityRating(qualityRating === star ? null : star)
              }
              accessibilityLabel={t("sends.rateStar", { count: star })}
            >
              <Ionicons
                name={
                  qualityRating && qualityRating >= star
                    ? "star"
                    : "star-outline"
                }
                size={32}
                color={colors.star}
              />
            </TouchableOpacity>
          ))}
        </View>

        {status === "sent" && (
          <>
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              {t("sends.difficultyForGrade")}
            </Text>
            <View style={styles.difficultyRow}>
              {DIFFICULTY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.difficultyOption,
                    { borderColor: colors.border },
                    difficultyRating === option.value && {
                      borderColor: colors.primary,
                      backgroundColor: colors.primaryLight,
                    },
                  ]}
                  onPress={() =>
                    setDifficultyRating(
                      difficultyRating === option.value ? null : option.value,
                    )
                  }
                >
                  <Text
                    style={[
                      styles.difficultyText,
                      { color: colors.textSecondary },
                      difficultyRating === option.value && {
                        color: colors.primary,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {status === "attempted" && (
          <>
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              {t("log.fallHoldLabel")}
            </Text>
            <TouchableOpacity
              style={[
                styles.fallHoldButton,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.cardBackground,
                },
                !onPickFallHold && styles.fallHoldButtonDisabled,
              ]}
              onPress={handlePickFallHold}
              disabled={!onPickFallHold}
            >
              <Ionicons
                name={fallHoldId ? "location" : "location-outline"}
                size={18}
                color={fallHoldId ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.fallHoldText,
                  {
                    color: fallHoldId ? colors.primary : colors.textSecondary,
                  },
                ]}
              >
                {fallHoldId ? t("log.fallHoldPicked") : t("log.fallHoldPick")}
              </Text>
            </TouchableOpacity>
            {fallHoldId && (
              <TouchableOpacity
                style={styles.fallHoldSkip}
                onPress={() => setFallHoldId(null)}
              >
                <Text
                  style={[
                    styles.fallHoldSkipText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("log.fallHoldSkip")}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  footerButtons: {
    gap: 12,
  },
  compactButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactText: {
    fontSize: 16,
    fontWeight: "600",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextOnFilled: {
    color: "#fff",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 8,
  },
  statusRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  statusText: {
    fontSize: 14,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 12,
  },
  difficultyOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  difficultyText: {
    fontSize: 14,
  },
  fallHoldButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  fallHoldButtonDisabled: {
    opacity: 0.6,
  },
  fallHoldText: {
    fontSize: 14,
    fontWeight: "600",
  },
  fallHoldSkip: {
    alignItems: "center",
    paddingVertical: 8,
  },
  fallHoldSkipText: {
    fontSize: 14,
    textDecorationLine: "underline",
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  removeButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  removeButtonText: {
    fontSize: 16,
  },
});
