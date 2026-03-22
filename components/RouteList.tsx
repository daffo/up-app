import { View, FlatList, Text, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RouteFilters } from '../types/database.types';
import { routesApi, RouteWithStats } from '../lib/api';
import { useThemeColors } from '../lib/theme-context';
import RouteCard from './RouteCard';
import { useApiQuery } from '../hooks/useApiQuery';

interface RouteListProps {
  onRoutePress: (routeId: string) => void;
  filters?: RouteFilters;
}

export default function RouteList({ onRoutePress, filters }: RouteListProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data: routes, loading, error, refreshing, refresh } = useApiQuery(
    () => routesApi.list(filters),
    [filters],
    { cacheKey: ['routes', 'sends'], initialData: [] as RouteWithStats[] },
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.errorText, { color: colors.danger }]}>{t('routes.error', { message: error })}</Text>
      </View>
    );
  }

  if (routes.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('routes.noRoutesYet')}</Text>
        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
          {t('routes.beFirstToAdd')}
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
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
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
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
});
