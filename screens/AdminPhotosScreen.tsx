import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import CachedImage from '../components/CachedImage';
import { useTranslation } from 'react-i18next';
import { Database } from '../types/database.types';
import { photosApi } from '../lib/api';
import { useThemeColors } from '../lib/theme-context';
import { formatDate } from '../utils/date';
import SafeScreen from '../components/SafeScreen';
import { useApiQuery } from '../hooks/useApiQuery';
import { ScreenProps } from '../navigation/types';

type Photo = Database['public']['Tables']['photos']['Row'];

export default function AdminPhotosScreen({ navigation }: ScreenProps<'AdminPhotos'>) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { data: photos, loading } = useApiQuery(
    () => photosApi.listAll() as Promise<Photo[]>,
    [],
    { cacheKey: 'photos', initialData: [] as Photo[] },
  );

  const renderPhoto = ({ item }: { item: Photo }) => (
    <TouchableOpacity
      style={[styles.photoCard, { backgroundColor: colors.cardBackground, shadowColor: colors.shadowColor }]}
      onPress={() => navigation.navigate('AdminPhotoDetail', { photoId: item.id })}
    >
      <CachedImage source={{ uri: item.image_url }} style={styles.thumbnail} />
      <View style={styles.photoInfo}>
        {!item.setup_date ? (
          <Text style={[styles.draftText, { color: colors.warning }]}>{t('admin.draft')}</Text>
        ) : (
          <>
            <Text style={[styles.dateText, { color: colors.textPrimary }]}>
              {t('admin.setup')}: {formatDate(item.setup_date)}
            </Text>
            {item.teardown_date ? (
              <Text style={[styles.dateText, { color: colors.textPrimary }]}>
                {t('admin.teardown')}: {formatDate(item.teardown_date)}
              </Text>
            ) : (
              <Text style={[styles.activeText, { color: colors.success }]}>{t('admin.active')}</Text>
            )}
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeScreen>
      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        renderItem={renderPhoto}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('admin.noPhotosFound')}</Text>
        }
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  photoCard: {
    flexDirection: 'row',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  thumbnail: {
    width: 100,
    height: 100,
  },
  photoInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 14,
    marginBottom: 4,
  },
  draftText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 32,
  },
});
