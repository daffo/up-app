import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { RouteFilters } from '../types/database.types';
import RouteList from '../components/RouteList';
import ProfileDropdown from '../components/ProfileDropdown';
import FilterModal from '../components/FilterModal';

const FILTERS_STORAGE_KEY = 'route_filters';

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { user, signOut, requireAuth } = useRequireAuth();
  const [filters, setFilters] = useState<RouteFilters>({});
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const prevUserIdRef = useRef<string | undefined>(undefined);

  const hasActiveFilters = !!filters.creatorId || !!filters.grade || !!filters.search;

  // Load filters from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(FILTERS_STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          setFilters(JSON.parse(stored));
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('home.title')}</Text>
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
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginText}>{t('home.login')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.contentHeader}>
          <Text style={styles.subtitle}>{t('home.sprayWallRoutes')}</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.filterButton, hasActiveFilters && styles.filterButtonActive]}
              onPress={() => setFilterModalVisible(true)}
            >
              <Ionicons
                name="filter"
                size={20}
                color={hasActiveFilters ? '#fff' : '#666'}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={handleAddRoute}>
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {hasActiveFilters && (
          <View style={styles.activeFiltersBar}>
            {filters.search && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>"{filters.search}"</Text>
                <TouchableOpacity
                  onPress={() => handleApplyFilters({ ...filters, search: undefined })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
            {filters.grade && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>{t('filters.grade')}: {filters.grade}</Text>
                <TouchableOpacity
                  onPress={() => handleApplyFilters({ ...filters, grade: undefined })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
            {filters.creatorId && (
              <View style={styles.filterChip}>
                <Text style={styles.filterChipText}>{t('home.myRoutes')}</Text>
                <TouchableOpacity
                  onPress={() => handleApplyFilters({ ...filters, creatorId: undefined })}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  loginButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0066cc',
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
    backgroundColor: '#eee',
  },
  filterButtonActive: {
    backgroundColor: '#0066cc',
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
    backgroundColor: '#e3f2fd',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: 16,
    gap: 6,
  },
  filterChipText: {
    fontSize: 14,
    color: '#0066cc',
  },
  addButton: {
    backgroundColor: '#0066cc',
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
