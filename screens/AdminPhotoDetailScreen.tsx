import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { Database, DetectedHold, Hold } from '../types/database.types';
import { detectedHoldsApi, photosApi } from '../lib/api';
import RouteVisualization from '../components/RouteVisualization';
import { useThemeColors } from '../lib/theme-context';
import { formatDate } from '../utils/date';
import { detectHolds } from '../lib/holdDetection';

type Photo = Database['public']['Tables']['photos']['Row'];

function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

function toYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

function WebDateInput({ value, onChange, colors }: {
  value: Date;
  onChange: (date: Date) => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <input
      type="date"
      value={toYMD(value)}
      onChange={(e) => {
        if (e.target.value) {
          onChange(new Date(e.target.value + 'T00:00:00'));
        }
      }}
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 16,
        color: colors.textPrimary,
        backgroundColor: colors.inputBackground,
        borderStyle: 'solid',
      }}
    />
  );
}

export default function AdminPhotoDetailScreen({ route }: any) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { photoId } = route.params;
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [detectedHolds, setDetectedHolds] = useState<DetectedHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [visualizationReady, setVisualizationReady] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectTile, setDetectTile] = useState(0);
  const [detectTotal, setDetectTotal] = useState(9);
  const [detectPhase, setDetectPhase] = useState<'tiles' | 'saving'>('tiles');
  const [editingField, setEditingField] = useState<'setup_date' | 'teardown_date' | null>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  useEffect(() => {
    fetchPhotoData();
  }, [photoId]);

  // Delay visualization rendering to allow spinner to show (only for large hold counts)
  useEffect(() => {
    if (!loading) {
      if (detectedHolds.length === 0) {
        setVisualizationReady(true);
      } else {
        const timer = setTimeout(() => {
          setVisualizationReady(true);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, detectedHolds.length]);

  const fetchPhotoData = async () => {
    const [photoData, holdsData] = await Promise.all([
      photosApi.get(photoId),
      detectedHoldsApi.listByPhoto(photoId),
    ]);

    if (photoData) {
      setPhoto(photoData as Photo);
    }
    setDetectedHolds(holdsData);
    setLoading(false);
  };

  const handleDeleteDetectedHold = (holdId: string) => {
    setDetectedHolds(prev => prev.filter(h => h.id !== holdId));
  };

  const handleUpdateDetectedHold = (holdId: string, updates: Partial<DetectedHold>) => {
    setDetectedHolds(prev => prev.map(h =>
      h.id === holdId ? { ...h, ...updates } : h
    ));
  };

  const handleAddDetectedHold = (hold: DetectedHold) => {
    setDetectedHolds(prev => [...prev, hold]);
  };

  const handleDetectHolds = async (regenerate = false) => {
    if (!photo) return;

    if (regenerate) {
      const confirmed = await new Promise<boolean>((resolve) => {
        if (Platform.OS === 'web') {
          resolve(window.confirm(t('admin.regenerateConfirm', { count: detectedHolds.length })));
        } else {
          Alert.alert(
            t('admin.regenerateHolds'),
            t('admin.regenerateConfirm', { count: detectedHolds.length }),
            [
              { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
              { text: t('common.delete'), style: 'destructive', onPress: () => resolve(true) },
            ],
          );
        }
      });
      if (!confirmed) return;

      try {
        await detectedHoldsApi.deleteByPhoto(photoId);
      } catch (err) {
        showAlert(t('common.error'), err instanceof Error ? err.message : String(err));
        return;
      }
      setDetectedHolds([]);
      setVisualizationReady(false);
    }

    const apiKey = process.env.EXPO_PUBLIC_ROBOFLOW_API_KEY;
    if (!apiKey) {
      showAlert(t('common.error'), 'EXPO_PUBLIC_ROBOFLOW_API_KEY not set');
      return;
    }

    setDetecting(true);
    setDetectTile(0);
    setDetectPhase('tiles');

    try {
      const results = await detectHolds(
        photo.image_url,
        apiKey,
        0.5,
        (tile, total) => {
          setDetectTile(tile);
          setDetectTotal(total);
        },
      );

      setDetectPhase('saving');

      const inserts = results.map((r) => ({
        photo_id: photoId,
        polygon: r.polygon,
        center: r.center,
        created_at: new Date().toISOString(),
      }));

      if (inserts.length > 0) {
        const newHolds = await detectedHoldsApi.createMany(inserts);
        setDetectedHolds(newHolds);
        setVisualizationReady(false);
      }

      setDetecting(false);
      showAlert(t('common.success'), t('admin.detectSuccess', { count: results.length }));
    } catch (err) {
      setDetecting(false);
      const message = err instanceof Error ? err.message : String(err);
      showAlert(t('admin.detectError'), message);
    }
  };

  const openDatePicker = (field: 'setup_date' | 'teardown_date') => {
    setPickerDate(new Date());
    setEditingField(field);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // On Android, the picker dismisses on any action
    if (Platform.OS === 'android') {
      setEditingField(null);
      if (event.type === 'dismissed' || !selectedDate) return;
      saveDate(editingField!, toYMD(selectedDate));
      return;
    }
    // On iOS, update the picker value; user will tap Save
    if (selectedDate) {
      setPickerDate(selectedDate);
    }
  };

  const handleWebDateChange = (date: Date) => {
    setPickerDate(date);
  };

  const saveDate = async (field: 'setup_date' | 'teardown_date', dateStr: string) => {
    if (!photo) return;

    try {
      await photosApi.update(photoId, { [field]: dateStr });
    } catch (err) {
      showAlert(t('common.error'), err instanceof Error ? err.message : String(err));
      return;
    }

    setPhoto({ ...photo, [field]: dateStr });
    setEditingField(null);
    showAlert(t('common.success'), t('admin.dateUpdated'));
  };

  const handleSavePickerDate = () => {
    if (!editingField) return;
    saveDate(editingField, toYMD(pickerDate));
  };

  // Create holds array that highlights ALL detected holds
  const allHoldsHighlighted: Hold[] = detectedHolds.map((dh, index) => ({
    order: index + 1,
    detected_hold_id: dh.id,
    labelX: dh.center.x,
    labelY: dh.center.y - 5,
  }));

  const hasHolds = detectedHolds.length > 0;
  const isLive = !!photo?.setup_date;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!photo) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{t('admin.photoNotFound')}</Text>
      </View>
    );
  }

  const renderDatePicker = (field: 'setup_date' | 'teardown_date') => {
    if (editingField !== field) return null;

    return (
      <View style={styles.pickerContainer}>
        {Platform.OS === 'web' ? (
          <WebDateInput value={pickerDate} onChange={handleWebDateChange} colors={colors} />
        ) : (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handleDateChange}
          />
        )}
        {/* Save/Cancel buttons (not needed on Android — picker auto-dismisses) */}
        {Platform.OS !== 'android' && (
          <View style={styles.pickerButtons}>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: colors.primary }]}
              onPress={handleSavePickerDate}
            >
              <Text style={styles.pickerButtonText}>{t('common.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: colors.cancelButton }]}
              onPress={() => setEditingField(null)}
            >
              <Text style={styles.pickerButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.screenBackground }]}>
      {/* Info Section */}
      <View style={[styles.infoSection, { backgroundColor: colors.cardBackground }]}>
        {/* Setup Date */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('admin.setupDate')}</Text>
        {photo.setup_date ? (
          <Text style={[styles.value, { color: colors.textPrimary }]}>{formatDate(photo.setup_date)}</Text>
        ) : (
          <Text style={[styles.value, { color: colors.textTertiary }]}>{t('admin.notSet')}</Text>
        )}
        {!isLive && editingField !== 'setup_date' && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary, opacity: hasHolds ? 1 : 0.5 }]}
            onPress={() => {
              if (!hasHolds) {
                showAlert(t('admin.cannotSetSetup'));
                return;
              }
              openDatePicker('setup_date');
            }}
            disabled={detecting}
          >
            <Text style={styles.actionButtonText}>{t('admin.setSetupDate')}</Text>
          </TouchableOpacity>
        )}
        {renderDatePicker('setup_date')}

        {/* Teardown Date */}
        {isLive && (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('admin.teardownDate')}</Text>
            {photo.teardown_date ? (
              <Text style={[styles.value, { color: colors.textPrimary }]}>{formatDate(photo.teardown_date)}</Text>
            ) : (
              <>
                {editingField !== 'teardown_date' && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={() => openDatePicker('teardown_date')}
                  >
                    <Text style={styles.actionButtonText}>{t('admin.setTeardownDate')}</Text>
                  </TouchableOpacity>
                )}
                {renderDatePicker('teardown_date')}
              </>
            )}
          </>
        )}

        {/* Holds Count */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('admin.detectedHolds')}</Text>
        <Text style={[styles.value, { color: colors.textPrimary }]}>{t('admin.holdsCount', { count: detectedHolds.length })}</Text>
      </View>

      {/* Hold Detection Buttons */}
      {!isLive && !detecting && (
        <View style={[styles.detectSection, { backgroundColor: colors.cardBackground }]}>
          {!hasHolds ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.detectButton, { backgroundColor: colors.primary }]}
              onPress={() => handleDetectHolds(false)}
            >
              <Text style={styles.actionButtonText}>{t('admin.detectHolds')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.detectButton, { borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => handleDetectHolds(true)}
            >
              <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>{t('admin.regenerateHolds')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Detection Progress Modal */}
      <Modal visible={detecting} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {detectPhase === 'saving' ? t('admin.savingHolds') : t('admin.detecting', { current: detectTile, total: detectTotal })}
            </Text>
            {detectPhase === 'tiles' && (
              <View style={[styles.progressBarBg, { backgroundColor: colors.borderLight }]}>
                <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${(detectTile / detectTotal) * 100}%` }]} />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* All Holds Preview */}
      <View style={[styles.previewSection, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('admin.allHoldsPreview')}</Text>
        <Text style={[styles.hint, { color: colors.textTertiary }]}>{t('admin.tapToOpenFullscreen')}</Text>
        {!visualizationReady ? (
          <View style={styles.visualizationLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('admin.renderingHolds', { count: detectedHolds.length })}</Text>
          </View>
        ) : (
          <RouteVisualization
            photoUrl={photo.image_url}
            holds={allHoldsHighlighted}
            detectedHolds={detectedHolds}
            showLabels={false}
            adminMode={true}
            photoId={photoId}
            onDeleteDetectedHold={handleDeleteDetectedHold}
            onUpdateDetectedHold={handleUpdateDetectedHold}
            onAddDetectedHold={handleAddDetectedHold}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  infoSection: {
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    marginTop: 12,
  },
  value: {
    fontSize: 16,
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerContainer: {
    marginTop: 8,
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  pickerButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  pickerButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  detectSection: {
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  detectButton: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    gap: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  previewSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    marginBottom: 12,
  },
  visualizationLoading: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});
