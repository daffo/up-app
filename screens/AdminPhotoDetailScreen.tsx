import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { Database, DetectedHold, Hold } from '../types/database.types';
import RouteVisualization from '../components/RouteVisualization';
import { formatDate } from '../utils/date';

type Photo = Database['public']['Tables']['photos']['Row'];

export default function AdminPhotoDetailScreen({ route }: any) {
  const { t } = useTranslation();
  const { photoId } = route.params;
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [detectedHolds, setDetectedHolds] = useState<DetectedHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [visualizationReady, setVisualizationReady] = useState(false);

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
    const [photoResult, holdsResult] = await Promise.all([
      supabase.from('photos').select('*').eq('id', photoId).single(),
      supabase.from('detected_holds').select('*').eq('photo_id', photoId),
    ]);

    if (photoResult.data) {
      setPhoto(photoResult.data);
    }
    if (holdsResult.data) {
      // Cast the data to DetectedHold[] with proper typing
      const holds = holdsResult.data.map((h) => ({
        ...h,
        polygon: h.polygon as Array<{ x: number; y: number }>,
        center: h.center as { x: number; y: number },
      }));
      setDetectedHolds(holds);
    }
    setLoading(false);
  };

  const handleDeleteDetectedHold = (holdId: string) => {
    // Remove from local state when a hold is deleted
    setDetectedHolds(prev => prev.filter(h => h.id !== holdId));
  };

  const handleUpdateDetectedHold = (holdId: string, updates: Partial<DetectedHold>) => {
    // Update local state when a hold is modified
    setDetectedHolds(prev => prev.map(h =>
      h.id === holdId ? { ...h, ...updates } : h
    ));
  };

  const handleAddDetectedHold = (hold: DetectedHold) => {
    // Add new hold to local state
    setDetectedHolds(prev => [...prev, hold]);
  };

  // Create holds array that highlights ALL detected holds
  const allHoldsHighlighted: Hold[] = detectedHolds.map((dh, index) => ({
    order: index + 1,
    detected_hold_id: dh.id,
    labelX: dh.center.x,
    labelY: dh.center.y - 5, // Slightly above center
  }));

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  if (!photo) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t('admin.photoNotFound')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.infoSection}>
        <Text style={styles.label}>{t('admin.setupDate')}</Text>
        <Text style={styles.value}>{formatDate(photo.setup_date)}</Text>

        {photo.teardown_date && (
          <>
            <Text style={styles.label}>{t('admin.teardownDate')}</Text>
            <Text style={styles.value}>{formatDate(photo.teardown_date)}</Text>
          </>
        )}

        <Text style={styles.label}>{t('admin.detectedHolds')}</Text>
        <Text style={styles.value}>{t('admin.holdsCount', { count: detectedHolds.length })}</Text>
      </View>

      <View style={styles.previewSection}>
        <Text style={styles.sectionTitle}>{t('admin.allHoldsPreview')}</Text>
        <Text style={styles.hint}>{t('admin.tapToOpenFullscreen')}</Text>
        {!visualizationReady ? (
          <View style={styles.visualizationLoading}>
            <ActivityIndicator size="large" color="#0066cc" />
            <Text style={styles.loadingText}>{t('admin.renderingHolds', { count: detectedHolds.length })}</Text>
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
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  infoSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
  },
  value: {
    fontSize: 16,
    color: '#333',
    marginTop: 4,
  },
  previewSection: {
    backgroundColor: '#fff',
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: '#999',
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
    color: '#666',
    fontSize: 14,
  },
});
