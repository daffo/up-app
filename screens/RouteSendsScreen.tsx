import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { sendsApi, userProfilesApi, cacheEvents } from '../lib/api';
import { Send } from '../types/database.types';
import UserNameLink from '../components/UserNameLink';
import { formatRelativeDate } from '../utils/date';

type SendWithProfile = Send & { displayName?: string };

export default function RouteSendsScreen({ route }: any) {
  const { t } = useTranslation();
  const { routeId } = route.params;
  const [sends, setSends] = useState<SendWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSends();
    const unsubscribe = cacheEvents.subscribe('sends', loadSends);
    return unsubscribe;
  }, [routeId]);

  const loadSends = async () => {
    try {
      const data = await sendsApi.listByRoute(routeId);

      // Fetch display names for all unique user IDs
      const userIds = [...new Set(data.map(s => s.user_id))];
      const profiles = await Promise.all(
        userIds.map(async (id) => {
          try {
            const profile = await userProfilesApi.get(id);
            return { id, displayName: profile?.display_name };
          } catch {
            return { id, displayName: undefined };
          }
        })
      );
      const profileMap = new Map(profiles.map(p => [p.id, p.displayName]));

      setSends(
        data.map(s => ({
          ...s,
          displayName: profileMap.get(s.user_id) || undefined,
        }))
      );
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
    if (rating === -1) return t('sends.soft');
    if (rating === 0) return t('sends.accurate');
    if (rating === 1) return t('sends.hard');
    return null;
  };

  const renderSend = ({ item: send }: { item: SendWithProfile }) => (
    <View style={styles.sendItem}>
      <View style={styles.sendHeader}>
        <UserNameLink
          userId={send.user_id}
          displayName={send.displayName}
          style={styles.sendUser}
        />
        <Text style={styles.sendDate}>{formatRelativeDate(send.sent_at)}</Text>
      </View>
      <View style={styles.sendRatings}>
        {send.quality_rating && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={14} color="#f5a623" />
            <Text style={styles.ratingText}>{send.quality_rating}</Text>
          </View>
        )}
        {send.difficulty_rating !== null && (
          <View style={styles.difficultyBadge}>
            <Text style={styles.difficultyText}>
              {getDifficultyLabel(send.difficulty_rating)}
            </Text>
          </View>
        )}
      </View>
    </View>
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
          <Text style={styles.emptyText}>{t('sends.noSendsYet')}</Text>
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sendUser: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  sendDate: {
    fontSize: 12,
    color: '#999',
  },
  sendRatings: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#e3f2fd',
    borderRadius: 4,
  },
  difficultyText: {
    fontSize: 12,
    color: '#0066cc',
  },
});
