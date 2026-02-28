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
import { useTranslation } from 'react-i18next';
import { Database, DetectedHold, Send } from '../types/database.types';
import { routesApi, detectedHoldsApi, userProfilesApi, sendsApi, cacheEvents } from '../lib/api';
import RouteVisualization from '../components/RouteVisualization';
import SendButton from '../components/SendButton';
import CommentsSection from '../components/CommentsSection';
import UserNameLink from '../components/UserNameLink';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useThemeColors } from '../lib/theme-context';
import { formatDate } from '../utils/date';
import SafeScreen from '../components/SafeScreen';

type Route = Database['public']['Tables']['routes']['Row'];
type Photo = Database['public']['Tables']['photos']['Row'];

interface RouteWithPhoto extends Route {
  photo?: Photo;
  creatorDisplayName?: string;
}

export default function RouteDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const colors = useThemeColors();
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

      // Fetch detected holds for the photo (with version-based caching)
      if (fetchedRoute?.photo_id) {
        try {
          const holdsVersion = (fetchedRoute as any).photo?.holds_version;
          const detectedHoldsData = await detectedHoldsApi.listByPhoto(
            fetchedRoute.photo_id,
            holdsVersion,
          );
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
      <View style={[styles.centerContainer, { backgroundColor: colors.screenBackground }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !routeData) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.screenBackground }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {error || 'Route not found'}
        </Text>
      </View>
    );
  }

  return (
    <SafeScreen>
      <ScrollView
        ref={scrollViewRef}
        style={[styles.container, { backgroundColor: colors.screenBackground }]}
        contentContainerStyle={{ paddingBottom: keyboardHeight }}
        keyboardShouldPersistTaps="handled"
      >
      <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{routeData.title}</Text>
        <View style={styles.headerMeta}>
          <Text style={[styles.grade, { color: colors.primary }]}>{routeData.grade}</Text>
          <Text style={[styles.holdCount, { color: colors.textSecondary }]}>{t('route.holds', { count: routeData.holds.length })}</Text>
        </View>
        {routeData.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>{routeData.description}</Text>
        )}
      </View>

      {routeData.photo && (
        <View style={[styles.imageSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <RouteVisualization
            photoUrl={routeData.photo.image_url}
            holds={routeData.holds}
            detectedHolds={detectedHolds}
          />
        </View>
      )}

      <View style={[styles.detailsSection, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={[styles.detailRow, { borderBottomColor: colors.separator }]}>
          <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>{t('route.createdBy')}</Text>
          <UserNameLink
            userId={routeData.user_id}
            displayName={routeData.creatorDisplayName}
            style={[styles.detailValue, { color: colors.textSecondary }]}
          />
        </View>
        <View style={[styles.detailRow, { borderBottomColor: colors.separator }]}>
          <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>{t('route.created')}</Text>
          <Text style={[styles.detailValue, { color: colors.textSecondary }]}>
            {formatDate(routeData.created_at)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.detailRow, { borderBottomColor: colors.separator }, !(user && routeData.user_id === user.id) && styles.detailRowLast]}
          onPress={() => navigation.navigate('RouteSends', { routeId })}
        >
          <Text style={[styles.detailLabel, { color: colors.textPrimary }]}>{t('route.rating')}</Text>
          <View style={styles.ratingValue}>
            {(() => {
              const ratings = sends.map(s => s.quality_rating).filter((r): r is number => r !== null);
              const avg = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null;
              return avg !== null ? (
                <>
                  <Ionicons name="star" size={16} color={colors.star} />
                  <Text style={[styles.ratingText, { color: colors.star }]}>{avg.toFixed(1)}</Text>
                  <Text style={[styles.sendCountText, { color: colors.textTertiary }]}>({sends.length})</Text>
                </>
              ) : (
                <Text style={[styles.detailValue, { color: colors.textSecondary }]}>{t('route.noRatingsYet')}</Text>
              );
            })()}
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} style={styles.chevron} />
          </View>
        </TouchableOpacity>
        {user && routeData.user_id === user.id && (
          <TouchableOpacity
            style={[styles.detailRow, styles.detailRowLast, { borderBottomColor: colors.separator }]}
            onPress={() => navigation.navigate('CreateEditRoute', { routeId })}
          >
            <Text style={[styles.editRouteLabel, { color: colors.primary }]}>{t('route.editRoute')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
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
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
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
  },
  holdCount: {
    fontSize: 14,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  imageSection: {
    marginTop: 12,
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  detailsSection: {
    marginTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 15,
  },
  detailValue: {
    fontSize: 15,
  },
  ratingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sendCountText: {
    fontSize: 14,
  },
  chevron: {
    marginLeft: 4,
  },
  editRouteLabel: {
    fontSize: 15,
  },
});
