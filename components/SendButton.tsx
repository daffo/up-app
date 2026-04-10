import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { sendsApi } from "../lib/api";
import { useThemeColors } from "../lib/theme-context";
import { useApiQuery } from "../hooks/useApiQuery";
import BottomSheet from "./BottomSheet";

interface SendButtonProps {
  routeId: string;
  userId?: string;
  onLoginRequired: () => void;
  compact?: boolean;
}

export default function SendButton({
  routeId,
  userId,
  onLoginRequired,
  compact,
}: SendButtonProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data: send, loading } = useApiQuery(
    () => sendsApi.getByUserAndRoute(userId!, routeId),
    [userId, routeId],
    { cacheKey: "sends", enabled: !!userId },
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [qualityRating, setQualityRating] = useState<number | null>(null);
  const [difficultyRating, setDifficultyRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const DIFFICULTY_OPTIONS = [
    { value: -1, label: t("sends.soft") },
    { value: 0, label: t("sends.accurate") },
    { value: 1, label: t("sends.hard") },
  ];

  // Sync form state when send data changes
  useEffect(() => {
    if (send) {
      setQualityRating(send.quality_rating);
      setDifficultyRating(send.difficulty_rating);
    }
  }, [send]);

  const handlePress = () => {
    if (!userId) {
      onLoginRequired();
      return;
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!userId) return;
    if (qualityRating !== null && (qualityRating < 1 || qualityRating > 5)) {
      Alert.alert(t("common.error"), t("sends.errorQualityRange"));
      return;
    }
    if (
      difficultyRating !== null &&
      (difficultyRating < -1 || difficultyRating > 1)
    ) {
      Alert.alert(t("common.error"), t("sends.errorDifficultyRange"));
      return;
    }
    setSaving(true);
    try {
      if (send) {
        await sendsApi.update(send.id, {
          quality_rating: qualityRating,
          difficulty_rating: difficultyRating,
        });
      } else {
        await sendsApi.create({
          user_id: userId,
          route_id: routeId,
          quality_rating: qualityRating,
          difficulty_rating: difficultyRating,
        });
      }
      setModalVisible(false);
    } catch (err) {
      console.error("Error saving send:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!send) return;
    setSaving(true);
    try {
      await sendsApi.delete(send.id);
      setQualityRating(null);
      setDifficultyRating(null);
      setModalVisible(false);
    } catch (err) {
      console.error("Error removing send:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <>
      {compact ? (
        <TouchableOpacity onPress={handlePress} style={styles.compactButton}>
          <Ionicons
            name={send ? "checkmark-circle" : "checkmark-circle-outline"}
            size={18}
            color={send ? colors.success : colors.primary}
          />
          <Text
            style={[
              styles.compactText,
              { color: send ? colors.success : colors.primary },
            ]}
          >
            {send ? t("sends.sent") : t("sends.send")}
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
            send && { backgroundColor: colors.primary },
          ]}
          onPress={handlePress}
        >
          <Ionicons
            name={send ? "checkmark-circle" : "checkmark-circle-outline"}
            size={20}
            color={send ? "#fff" : colors.primary}
          />
          <Text
            style={[
              styles.buttonText,
              { color: colors.primary },
              send && styles.buttonTextSent,
            ]}
          >
            {send ? t("sends.sent") : t("sends.logSend")}
          </Text>
        </TouchableOpacity>
      )}

      <BottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={send ? t("sends.editSend") : t("sends.logSend")}
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
                {send ? t("common.update") : t("sends.logSend")}
              </Text>
            </TouchableOpacity>

            {send && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={handleRemove}
                disabled={saving}
              >
                <Text
                  style={[styles.removeButtonText, { color: colors.danger }]}
                >
                  {t("sends.removeSend")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      >
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

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
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
  buttonTextSent: {
    color: "#fff",
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 8,
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
