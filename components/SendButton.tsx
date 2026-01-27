import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Send } from '../types/database.types';
import { sendsApi, cacheEvents } from '../lib/api';

interface SendButtonProps {
  routeId: string;
  userId?: string;
  onLoginRequired: () => void;
}

const DIFFICULTY_OPTIONS = [
  { value: -1, label: 'Soft' },
  { value: 0, label: 'Accurate' },
  { value: 1, label: 'Hard' },
];

export default function SendButton({ routeId, userId, onLoginRequired }: SendButtonProps) {
  const [send, setSend] = useState<Send | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [qualityRating, setQualityRating] = useState<number | null>(null);
  const [difficultyRating, setDifficultyRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

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
      <TouchableOpacity
        style={[styles.button, send && styles.buttonSent]}
        onPress={handlePress}
      >
        <Ionicons
          name={send ? 'checkmark-circle' : 'checkmark-circle-outline'}
          size={20}
          color={send ? '#fff' : '#0066cc'}
        />
        <Text style={[styles.buttonText, send && styles.buttonTextSent]}>
          {send ? 'Sent' : 'Log Send'}
        </Text>
      </TouchableOpacity>

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
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>{send ? 'Edit Send' : 'Log Send'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              <Text style={styles.sectionLabel}>Quality Rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setQualityRating(qualityRating === star ? null : star)}
                  >
                    <Ionicons
                      name={qualityRating && qualityRating >= star ? 'star' : 'star-outline'}
                      size={32}
                      color="#f5a623"
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Difficulty for Grade</Text>
              <View style={styles.difficultyRow}>
                {DIFFICULTY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.difficultyOption,
                      difficultyRating === option.value && styles.difficultyOptionSelected,
                    ]}
                    onPress={() =>
                      setDifficultyRating(difficultyRating === option.value ? null : option.value)
                    }
                  >
                    <Text
                      style={[
                        styles.difficultyText,
                        difficultyRating === option.value && styles.difficultyTextSelected,
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
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {send ? 'Update' : 'Log Send'}
                </Text>
              </TouchableOpacity>

              {send && (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={handleRemove}
                  disabled={saving}
                >
                  <Text style={styles.removeButtonText}>Remove Send</Text>
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0066cc',
    backgroundColor: '#fff',
  },
  buttonSent: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066cc',
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
    backgroundColor: '#fff',
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
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
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
    borderColor: '#ddd',
    alignItems: 'center',
  },
  difficultyOptionSelected: {
    borderColor: '#0066cc',
    backgroundColor: '#e3f2fd',
  },
  difficultyText: {
    fontSize: 14,
    color: '#666',
  },
  difficultyTextSelected: {
    color: '#0066cc',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    gap: 12,
  },
  saveButton: {
    backgroundColor: '#0066cc',
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
    color: '#dc3545',
    fontSize: 16,
  },
});
