import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import { sendsApi, cacheEvents } from '../lib/api';
import { Send } from '../types/database.types';
import { formatRelativeDate } from '../utils/date';

type SendWithRoute = Send & { route: { id: string; title: string; grade: string } };

export default function MySendsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [sends, setSends] = useState<SendWithRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadSends();
      const unsubscribe = cacheEvents.subscribe('sends', loadSends);
      return unsubscribe;
    }
  }, [user]);

  const loadSends = async () => {
    if (!user) return;
    try {
      const data = await sendsApi.listByUser(user.id);
      setSends(data);
    } catch (error) {
      console.error('Error loading sends:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSends();
  };

  const getDifficultyLabel = (rating: number | null) => {
    if (rating === -1) return 'Soft';
    if (rating === 0) return 'Accurate';
    if (rating === 1) return 'Hard';
    return null;
  };

  const renderSend = ({ item: send }: { item: SendWithRoute }) => (
    <TouchableOpacity
      style={styles.sendItem}
      onPress={() => navigation.navigate('RouteDetail', { routeId: send.route.id })}
    >
      <View style={styles.sendInfo}>
        <Text style={styles.sendTitle}>{send.route.title}</Text>
        <View style={styles.sendMeta}>
          <Text style={styles.sendGrade}>{send.route.grade}</Text>
          {send.quality_rating && (
            <View style={styles.sendRating}>
              <Ionicons name="star" size={12} color="#f5a623" />
              <Text style={styles.sendRatingText}>{send.quality_rating}</Text>
            </View>
          )}
          {send.difficulty_rating !== null && (
            <Text style={styles.sendDifficulty}>
              {getDifficultyLabel(send.difficulty_rating)}
            </Text>
          )}
        </View>
        <Text style={styles.sendDate}>{formatRelativeDate(send.sent_at)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sends}
        keyExtractor={(item) => item.id}
        renderItem={renderSend}
        contentContainerStyle={sends.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No sends yet. Start climbing!</Text>
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  sendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sendInfo: {
    flex: 1,
  },
  sendTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  sendMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  sendGrade: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
  },
  sendRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sendRatingText: {
    fontSize: 12,
    color: '#666',
  },
  sendDifficulty: {
    fontSize: 12,
    color: '#666',
  },
  sendDate: {
    fontSize: 12,
    color: '#999',
  },
});
