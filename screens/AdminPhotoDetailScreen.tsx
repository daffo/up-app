import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Database, DetectedHold, Hold } from '../types/database.types';
import { detectedHoldsApi, photosApi } from '../lib/api';
import RouteVisualization from '../components/RouteVisualization';
import { useThemeColors } from '../lib/theme-context';
import { formatDate } from '../utils/date';
import { detectHolds } from '../lib/holdDetection';

type Photo = Database['public']['Tables']['photos']['Row'];

export default function AdminPhotoDetailScreen({ route }: any) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { photoId } = route.params;
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [detectedHolds, setDetectedHolds] = useState<DetectedHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [visualizationReady, setVisualizationReady] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectProgress, setDetectProgress] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [showSetupDateInput, setShowSetupDateInput] = useState(false);
  const [showTeardownDateInput, setShowTeardownDateInput] = useState(false);

  useEffect(() => {
    fetchPhotoData();
  }, [photoId]);

  // Delay visualization rendering to allow spinner to show
  useEffect(() => {
    if (!loading && detectedHolds.length > 0) {
      const timer = setTimeout(() => {
        setVisualizationReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, detectedHolds.length]);

  const fetchPhotoData = async () => {
    // Fetch photo and detected holds in parallel
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

      // Delete all existing detected holds for this photo
      try {
        await detectedHoldsApi.deleteByPhoto(photoId);
      } catch (err) {
        Alert.alert(t('common.error'), err instanceof Error ? err.message : String(err));
        return;
      }
      setDetectedHolds([]);
      setVisualizationReady(false);
    }

    const apiKey = process.env.EXPO_PUBLIC_ROBOFLOW_API_KEY;
    if (!apiKey) {
      Alert.alert(t('common.error'), 'EXPO_PUBLIC_ROBOFLOW_API_KEY not set');
      return;
    }

    setDetecting(true);
    setDetectProgress(t('admin.detecting', { current: 0, total: 9 }));

    try {
      const results = await detectHolds(
        photo.image_url,
        apiKey,
        0.5,
        (tile, total) => {
          setDetectProgress(t('admin.detecting', { current: tile, total }));
        },
      );

      // Insert detected holds into database
      const inserts = results.map((r) => ({
        photo_id: photoId,
        polygon: r.polygon,
        center: r.center,
        created_at: new Date().toISOString(),
      }));

      if (inserts.length > 0) {
        const newHolds = await detectedHoldsApi.createMany(inserts);
        setDetectedHolds(newHolds);
        setVisualizationReady(false); // Will re-trigger the delay effect
      }
      Alert.alert(t('common.success'), t('admin.detectSuccess', { count: results.length }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Alert.alert(t('admin.detectError'), message);
    } finally {
      setDetecting(false);
      setDetectProgress('');
    }
  };

  const handleUpdateDate = async (field: 'setup_date' | 'teardown_date') => {
    if (!photo) return;

    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      Alert.alert(t('common.error'), 'Use YYYY-MM-DD format');
      return;
    }

    try {
      await photosApi.update(photoId, { [field]: dateInput });
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : String(err));
      return;
    }

    setPhoto({ ...photo, [field]: dateInput });
    setDateInput('');
    setShowSetupDateInput(false);
    setShowTeardownDateInput(false);
    Alert.alert(t('common.success'), t('admin.dateUpdated'));
  };

  // Create holds array that highlights ALL detected holds
  const allHoldsHighlighted: Hold[] = detectedHolds.map((dh, index) => ({
    order: index + 1,
    detected_hold_id: dh.id,
    labelX: dh.center.x,
    labelY: dh.center.y - 5, // Slightly above center
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
        {!isLive && (
          showSetupDateInput ? (
            <View style={styles.dateInputRow}>
              <TextInput
                style={[styles.dateInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                value={dateInput}
                onChangeText={setDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.placeholderText}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.primary }]}
                onPress={() => handleUpdateDate('setup_date')}
              >
                <Text style={styles.dateButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateButton, { backgroundColor: colors.cancelButton }]}
                onPress={() => { setShowSetupDateInput(false); setDateInput(''); }}
              >
                <Text style={styles.dateButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary, opacity: hasHolds ? 1 : 0.5 }]}
              onPress={() => {
                if (!hasHolds) {
                  Alert.alert(t('admin.cannotSetSetup'));
                  return;
                }
                setDateInput(new Date().toISOString().split('T')[0]);
                setShowSetupDateInput(true);
              }}
              disabled={detecting}
            >
              <Text style={styles.actionButtonText}>{t('admin.setSetupDate')}</Text>
            </TouchableOpacity>
          )
        )}

        {/* Teardown Date */}
        {isLive && (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('admin.teardownDate')}</Text>
            {photo.teardown_date ? (
              <Text style={[styles.value, { color: colors.textPrimary }]}>{formatDate(photo.teardown_date)}</Text>
            ) : (
              showTeardownDateInput ? (
                <View style={styles.dateInputRow}>
                  <TextInput
                    style={[styles.dateInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
                    value={dateInput}
                    onChangeText={setDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.placeholderText}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: colors.primary }]}
                    onPress={() => handleUpdateDate('teardown_date')}
                  >
                    <Text style={styles.dateButtonText}>{t('common.save')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dateButton, { backgroundColor: colors.cancelButton }]}
                    onPress={() => { setShowTeardownDateInput(false); setDateInput(''); }}
                  >
                    <Text style={styles.dateButtonText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setDateInput(new Date().toISOString().split('T')[0]);
                    setShowTeardownDateInput(true);
                  }}
                >
                  <Text style={styles.actionButtonText}>{t('admin.setTeardownDate')}</Text>
                </TouchableOpacity>
              )
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

      {/* Detection Progress */}
      {detecting && (
        <View style={[styles.detectSection, { backgroundColor: colors.cardBackground }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{detectProgress}</Text>
        </View>
      )}

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
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  dateButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  dateButtonText: {
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
