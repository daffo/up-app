import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Send } from '../types/database.types';
import { sendsApi, cacheEvents } from '../lib/api';
import { useThemeColors } from '../lib/theme-context';

interface SendButtonProps {
  routeId: string;
  userId?: string;
  onLoginRequired: () => void;
  compact?: boolean;
}

export default function SendButton({ routeId, userId, onLoginRequired, compact }: SendButtonProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [send, setSend] = useState<Send | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [qualityRating, setQualityRating] = useState<number | null>(null);
  const [difficultyRating, setDifficultyRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const DIFFICULTY_OPTIONS = [
    { value: -1, label: t('sends.soft') },
    { value: 0, label: t('sends.accurate') },
    { value: 1, label: t('sends.hard') },
  ];

  useEffect(() => {
    if (userId) {
      fetchSend();
      const unsubscribe = cacheEvents.subscribe('sends', fetchSend);
      return unsubscribe;
    } else {
      setLoading(false);
    }
  }, [userId, routeId]);

  const fetchSend = async () => {
    if (!userId) return;
    try {
      const data = await sendsApi.getByUserAndRoute(userId, routeId);
      setSend(data);
      if (data) {
        setQualityRating(data.quality_rating);
        setDifficultyRating(data.difficulty_rating);
      }
    } catch (err) {
      console.error('Error fetching send:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    if (!userId) {
      onLoginRequired();
      return;
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!userId) return;
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
      console.error('Error saving send:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!send) return;
    setSaving(true);
    try {
      await sendsApi.delete(send.id);
      setSend(null);
      setQualityRating(null);
      setDifficultyRating(null);
      setModalVisible(false);
    } catch (err) {
      console.error('Error removing send:', err);
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
            name={send ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={18}
            color={send ? '#28a745' : colors.primary}
          />
          <Text style={[styles.compactText, { color: colors.primary }, send && styles.compactTextSent]}>
            {send ? t('sends.sent') : t('sends.send')}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, { borderColor: colors.primary, backgroundColor: colors.cardBackground }, send && { backgroundColor: colors.primary }]}
          onPress={handlePress}
        >
          <Ionicons
            name={send ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={20}
            color={send ? '#fff' : colors.primary}
          />
          <Text style={[styles.buttonText, { color: colors.primary }, send && styles.buttonTextSent]}>
            {send ? t('sends.sent') : t('sends.logSend')}
          </Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            onPress={() => setModalVisible(false)}
          />
          <View style={[styles.sheet, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{send ? t('sends.editSend') : t('sends.logSend')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={[styles.closeButton, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('sends.qualityRating')}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setQualityRating(qualityRating === star ? null : star)}
                    accessibilityLabel={t('sends.rateStar', { count: star })}
                  >
                    <Ionicons
                      name={qualityRating && qualityRating >= star ? 'star' : 'star-outline'}
                      size={32}
                      color={colors.star}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('sends.difficultyForGrade')}</Text>
              <View style={styles.difficultyRow}>
                {DIFFICULTY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.difficultyOption,
                      { borderColor: colors.border },
                      difficultyRating === option.value && { borderColor: colors.primary, backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() =>
                      setDifficultyRating(difficultyRating === option.value ? null : option.value)
                    }
                  >
                    <Text
                      style={[
                        styles.difficultyText,
                        { color: colors.textSecondary },
                        difficultyRating === option.value && { color: colors.primary, fontWeight: '600' },
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {send ? t('common.update') : t('sends.logSend')}
                </Text>
              </TouchableOpacity>

              {send && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={handleRemove}
                  disabled={saving}
                >
                  <Text style={[styles.removeButtonText, { color: colors.danger }]}>{t('sends.removeSend')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  compactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactText: {
    fontSize: 16,
    fontWeight: '600',
  },
  compactTextSent: {
    color: '#28a745',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSent: {
    color: '#fff',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 16,
  },
  content: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  difficultyOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  difficultyText: {
    fontSize: 14,
  },
  footer: {
    padding: 16,
    gap: 12,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 16,
  },
});
