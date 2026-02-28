import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SafeScreen from '../components/SafeScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { RouteFilters } from '../types/database.types';
import RouteList from '../components/RouteList';
import ProfileDropdown from '../components/ProfileDropdown';
import FilterModal from '../components/FilterModal';
import { useThemeColors } from '../lib/theme-context';

const FILTERS_STORAGE_KEY = 'route_filters';

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { user, signOut, requireAuth } = useRequireAuth();
  const [filters, setFilters] = useState<RouteFilters>({ wallStatus: 'active' });
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const prevUserIdRef = useRef<string | undefined>(undefined);

  const wallStatus = filters.wallStatus ?? 'active';
  const hasActiveFilters = !!filters.creatorId || !!filters.grade || !!filters.search || wallStatus !== 'active';

  // Load filters from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(FILTERS_STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setFilters({ wallStatus: 'active', ...parsed });
        } catch (e) {
          console.error('Failed to parse stored filters:', e);
        }
      }
      setFiltersLoaded(true);
    });
  }, []);

  // Clear user-specific filters when user changes (login/logout)
  useEffect(() => {
    if (filtersLoaded && prevUserIdRef.current !== user?.id) {
      if (prevUserIdRef.current !== undefined) {
        // User changed - clear creatorId filter
        const newFilters = { ...filters, creatorId: undefined };
        setFilters(newFilters);
        AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(newFilters));
      }
      prevUserIdRef.current = user?.id;
    }
  }, [user?.id, filtersLoaded]);

  // Save filters to storage when they change
  const handleApplyFilters = (newFilters: RouteFilters) => {
    setFilters(newFilters);
    AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(newFilters));
  };

  const handleAddRoute = () => {
    requireAuth(() => navigation.navigate('CreateEditRoute'), 'CreateEditRoute');
  };

  const handleRoutePress = (routeId: string) => {
    navigation.navigate('RouteDetail', { routeId });
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <SafeScreen hasHeader={false}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('home.title')}</Text>
        {user ? (
          <ProfileDropdown
            onMyAccount={() => navigation.navigate('MyAccount')}
            onMySends={() => navigation.navigate('MySends')}
            onMyComments={() => navigation.navigate('MyComments')}
            onAdmin={() => navigation.navigate('AdminPhotos')}
            onLogout={handleLogout}
          />
        ) : (
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginText}>{t('home.login')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.contentHeader}>
          <Text style={[styles.subtitle, { color: colors.textPrimary }]}>{t('home.sprayWallRoutes')}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.filterButton, { backgroundColor: colors.borderLight }, hasActiveFilters && { backgroundColor: colors.primary }]}
              onPress={() => setFilterModalVisible(true)}
              accessibilityLabel={t('filters.openFilters')}
            >
              <Ionicons
                name="filter"
                size={20}
                color={hasActiveFilters ? '#fff' : colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAddRoute}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.activeFiltersBar}>
          <TouchableOpacity
            style={[styles.filterChip, { backgroundColor: wallStatus === 'active' ? colors.borderLight : colors.primaryLight }]}
            onPress={() => wallStatus !== 'active' ? handleApplyFilters({ ...filters, wallStatus: 'active' }) : setFilterModalVisible(true)}
            accessibilityLabel={wallStatus !== 'active' ? t('filters.clearWall') : t('filters.wall')}
          >
            <Text style={[styles.filterChipText, { color: wallStatus === 'active' ? colors.textSecondary : colors.primary }]}>
              {t(`filters.wall${wallStatus.charAt(0).toUpperCase() + wallStatus.slice(1)}`)}
            </Text>
            {wallStatus !== 'active' && (
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
          {filters.search && (
            <TouchableOpacity
              style={[styles.filterChip, { backgroundColor: colors.primaryLight }]}
              onPress={() => handleApplyFilters({ ...filters, search: undefined })}
              accessibilityLabel={t('filters.clearSearch')}
            >
              <Text style={[styles.filterChipText, { color: colors.primary }]}>"{filters.search}"</Text>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {filters.grade && (
            <TouchableOpacity
              style={[styles.filterChip, { backgroundColor: colors.primaryLight }]}
              onPress={() => handleApplyFilters({ ...filters, grade: undefined })}
              accessibilityLabel={t('filters.clearGrade')}
            >
              <Text style={[styles.filterChipText, { color: colors.primary }]}>{t('filters.grade')}: {filters.grade}</Text>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {filters.creatorId && (
            <TouchableOpacity
              style={[styles.filterChip, { backgroundColor: colors.primaryLight }]}
              onPress={() => handleApplyFilters({ ...filters, creatorId: undefined })}
              accessibilityLabel={t('filters.clearMyRoutes')}
            >
              <Text style={[styles.filterChipText, { color: colors.primary }]}>{t('home.myRoutes')}</Text>
              <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {filtersLoaded && <RouteList onRoutePress={handleRoutePress} filters={filters} />}

        <FilterModal
          visible={filterModalVisible}
          filters={filters}
          userId={user?.id}
          onClose={() => setFilterModalVisible(false)}
          onApply={handleApplyFilters}
          onLoginRequired={() => requireAuth(() => setFilterModalVisible(true), 'Home')}
        />
      </View>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  loginButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  loginText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFiltersBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    gap: 6,
  },
  filterChipText: {
    fontSize: 14,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
});
