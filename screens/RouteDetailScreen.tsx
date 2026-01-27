import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Database, DetectedHold, Send } from '../types/database.types';
import { routesApi, detectedHoldsApi, userProfilesApi, sendsApi, cacheEvents } from '../lib/api';
import RouteVisualization from '../components/RouteVisualization';
import SendButton from '../components/SendButton';
import CommentsSection from '../components/CommentsSection';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { formatDate } from '../utils/date';

type Route = Database['public']['Tables']['routes']['Row'];
type Photo = Database['public']['Tables']['photos']['Row'];

interface RouteWithPhoto extends Route {
  photo?: Photo;
  creatorDisplayName?: string;
}

export default function RouteDetailScreen({ route, navigation }: any) {
  const { routeId } = route.params;
  const { user, requireAuth } = useRequireAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const [routeData, setRouteData] = useState<RouteWithPhoto | null>(null);
  const [detectedHolds, setDetectedHolds] = useState<DetectedHold[]>([]);
  const [sends, setSends] = useState<Send[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    fetchRouteDetail();
    fetchSends();

    const unsubscribeRoute = cacheEvents.subscribe('route', fetchRouteDetail);
    const unsubscribeSends = cacheEvents.subscribe('sends', fetchSends);
    return () => {
      unsubscribeRoute();
      unsubscribeSends();
    };
  }, [routeId]);

  const fetchSends = async () => {
    try {
      const data = await sendsApi.listByRoute(routeId);
      setSends(data);
    } catch (err) {
      console.error('Error fetching sends:', err);
    }
  };

  useEffect(() => {
    // Set send button in navigation header
    navigation.setOptions({
      headerRight: () => (
        <View style={{ marginRight: 10 }}>
          <SendButton
            routeId={routeId}
            userId={user?.id}
            onLoginRequired={() => requireAuth(() => {}, 'RouteDetail')}
            compact
          />
        </View>
      ),
    });
  }, [user, navigation, routeId, requireAuth]);

  const fetchRouteDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch route with photo
      const fetchedRoute = await routesApi.get(routeId);

      // Fetch creator's display name
      let creatorDisplayName: string | undefined;
      if (fetchedRoute?.user_id) {
        try {
          const profile = await userProfilesApi.get(fetchedRoute.user_id);
          creatorDisplayName = profile?.display_name || undefined;
        } catch (profileErr) {
          console.error('Error fetching creator profile:', profileErr);
        }
      }

      setRouteData({ ...fetchedRoute, creatorDisplayName } as RouteWithPhoto);

      // Fetch detected holds for the photo
      if (fetchedRoute?.photo_id) {
        try {
          const detectedHoldsData = await detectedHoldsApi.listByPhoto(fetchedRoute.photo_id);
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
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: keyboardHeight }}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.header}>
        <Text style={styles.title}>{routeData.title}</Text>
        <View style={styles.headerMeta}>
          <Text style={styles.grade}>{routeData.grade}</Text>
          <Text style={styles.holdCount}>{routeData.holds.length} holds</Text>
        </View>
        {routeData.description && (
          <Text style={styles.description}>{routeData.description}</Text>
        )}
      </View>

      {routeData.photo && (
        <View style={styles.imageSection}>
          <RouteVisualization
            photoUrl={routeData.photo.image_url}
            holds={routeData.holds}
            detectedHolds={detectedHolds}
          />
        </View>
      )}

      <View style={styles.detailsSection}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created by</Text>
          <Text style={styles.detailValue}>
            {routeData.creatorDisplayName || 'Unknown'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Created</Text>
          <Text style={styles.detailValue}>
            {formatDate(routeData.created_at)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.detailRow, !(user && routeData.user_id === user.id) && styles.detailRowLast]}
          onPress={() => navigation.navigate('RouteSends', { routeId })}
        >
          <Text style={styles.detailLabel}>Rating</Text>
          <View style={styles.ratingValue}>
            {(() => {
              const ratings = sends.map(s => s.quality_rating).filter((r): r is number => r !== null);
              const avg = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;
              return avg !== null ? (
                <>
                  <Ionicons name="star" size={16} color="#f5a623" />
                  <Text style={styles.ratingText}>{avg.toFixed(1)}</Text>
                  <Text style={styles.sendCountText}>({sends.length})</Text>
                </>
              ) : (
                <Text style={styles.detailValue}>No ratings yet</Text>
              );
            })()}
            <Ionicons name="chevron-forward" size={20} color="#999" style={styles.chevron} />
          </View>
        </TouchableOpacity>
        {user && routeData.user_id === user.id && (
          <TouchableOpacity
            style={[styles.detailRow, styles.detailRowLast]}
            onPress={() => navigation.navigate('CreateEditRoute', { routeId })}
          >
            <Text style={styles.editRouteLabel}>Edit Route</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <CommentsSection
        routeId={routeId}
        userId={user?.id}
        onLoginRequired={() => requireAuth(() => {}, 'RouteDetail')}
        onInputFocus={() => {
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 300);
        }}
      />
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  grade: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0066cc',
  },
  holdCount: {
    fontSize: 14,
    color: '#666',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
  },
  imageSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  detailsSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 15,
    color: '#333',
  },
  detailValue: {
    fontSize: 15,
    color: '#666',
  },
  ratingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f5a623',
  },
  sendCountText: {
    fontSize: 14,
    color: '#999',
  },
  chevron: {
    marginLeft: 4,
  },
  editRouteLabel: {
    fontSize: 15,
    color: '#0066cc',
  },
});
