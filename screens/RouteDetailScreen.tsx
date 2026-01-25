import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Database, DetectedHold } from '../types/database.types';
import { routesApi, detectedHoldsApi } from '../lib/api';
import RouteVisualization from '../components/RouteVisualization';
import { useAuth } from '../lib/auth-context';

type Route = Database['public']['Tables']['routes']['Row'];
type Photo = Database['public']['Tables']['photos']['Row'];

interface RouteWithPhoto extends Route {
  photo?: Photo;
}

export default function RouteDetailScreen({ route, navigation }: any) {
  const { routeId } = route.params;
  const { user } = useAuth();
  const [routeData, setRouteData] = useState<RouteWithPhoto | null>(null);
  const [detectedHolds, setDetectedHolds] = useState<DetectedHold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRouteDetail();
  }, [routeId]);

  useEffect(() => {
    // Set edit button in navigation header if user owns the route
    if (routeData && user && routeData.user_id === user.id) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateEditRoute', { routeId })}
            style={{ marginRight: 10 }}
          >
            <Text style={{ color: '#0066cc', fontSize: 16, fontWeight: '600' }}>
              Edit
            </Text>
          </TouchableOpacity>
        ),
      });
    }
  }, [routeData, user, navigation, routeId]);

  const fetchRouteDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch route with photo
      const routeData = await routesApi.get(routeId);
      setRouteData(routeData as RouteWithPhoto);

      // Fetch detected holds for the photo
      if (routeData?.photo_id) {
        try {
          const detectedHoldsData = await detectedHoldsApi.listByPhoto(routeData.photo_id);
          setDetectedHolds(detectedHoldsData);
        } catch (holdsErr) {
          console.error('Error fetching detected holds:', holdsErr);
        }
      }
    } catch (err) {
      console.error('Error fetching route:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch route');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  if (error || !routeData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {error || 'Route not found'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{routeData.title}</Text>
        <Text style={styles.grade}>{routeData.grade}</Text>
      </View>

      {routeData.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{routeData.description}</Text>
        </View>
      )}

      {routeData.photo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route Visualization</Text>
          <RouteVisualization
            photoUrl={routeData.photo.image_url}
            holds={routeData.holds}
            detectedHolds={detectedHolds}
          />
          <View style={styles.photoInfo}>
            <Text style={styles.photoDate}>
              Setup: {new Date(routeData.photo.setup_date).toLocaleDateString()}
            </Text>
            {routeData.photo.teardown_date && (
              <Text style={styles.photoDate}>
                Teardown: {new Date(routeData.photo.teardown_date).toLocaleDateString()}
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created:</Text>
          <Text style={styles.detailValue}>
            {new Date(routeData.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Holds:</Text>
          <Text style={styles.detailValue}>
            {routeData.holds.length} holds
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  grade: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
  },
  photoInfo: {
    marginTop: 12,
  },
  photoDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  detailValue: {
    fontSize: 16,
    color: '#666',
  },
});
