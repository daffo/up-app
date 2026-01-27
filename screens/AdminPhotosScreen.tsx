import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database.types';
import { formatDate } from '../utils/date';

type Photo = Database['public']['Tables']['photos']['Row'];

export default function AdminPhotosScreen({ navigation }: any) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('setup_date', { ascending: false });

    if (!error && data) {
      setPhotos(data);
    }
    setLoading(false);
  };

  const renderPhoto = ({ item }: { item: Photo }) => (
    <TouchableOpacity
      style={styles.photoCard}
      onPress={() => navigation.navigate('AdminPhotoDetail', { photoId: item.id })}
    >
      <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
      <View style={styles.photoInfo}>
        <Text style={styles.dateText}>
          Setup: {formatDate(item.setup_date)}
        </Text>
        {item.teardown_date && (
          <Text style={styles.dateText}>
            Teardown: {formatDate(item.teardown_date)}
          </Text>
        )}
        {!item.teardown_date && (
          <Text style={styles.activeText}>Active</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        renderItem={renderPhoto}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No photos found</Text>
        }
      />
    </View>
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
  list: {
    padding: 16,
  },
  photoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
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
    color: '#333',
    marginBottom: 4,
  },
  activeText: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 32,
  },
});
