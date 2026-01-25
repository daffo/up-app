import { useState, useEffect } from 'react';
import { View, FlatList, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Database } from '../types/database.types';
import { routesApi, cacheEvents } from '../lib/api';
import RouteCard from './RouteCard';

type Route = Database['public']['Tables']['routes']['Row'];

interface RouteListProps {
  onRoutePress: (routeId: string) => void;
}

export default function RouteList({ onRoutePress }: RouteListProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await routesApi.list();
      setRoutes(data);
    } catch (err) {
      console.error('Error fetching routes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch routes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => fetchRoutes(true);

  useEffect(() => {
    fetchRoutes();

    // Subscribe to routes cache invalidation
    const unsubscribe = cacheEvents.subscribe('routes', fetchRoutes);
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (routes.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No routes yet</Text>
        <Text style={styles.emptySubtext}>
          Be the first to add a route!
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={routes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <RouteCard route={item} onPress={() => onRoutePress(item.id)} />
      )}
      contentContainerStyle={styles.listContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});
