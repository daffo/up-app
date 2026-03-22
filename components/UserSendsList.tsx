import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { sendsApi } from '../lib/api';
import { Send } from '../types/database.types';
import { useThemeColors } from '../lib/theme-context';
import { formatRelativeDate } from '../utils/date';
import { getDifficultyLabel } from '../utils/sends';
import { useApiQuery } from '../hooks/useApiQuery';

type SendWithRoute = Send & { route: { id: string; title: string; grade: string } };

interface UserSendsListProps {
  userId: string;
  emptyMessage?: string;
}

export default function UserSendsList({ userId, emptyMessage }: UserSendsListProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const navigation = useNavigation<any>();
  const { data: sends, loading, refreshing, refresh } = useApiQuery(
    () => sendsApi.listByUser(userId),
    [userId],
    { cacheKey: 'sends', initialData: [] as SendWithRoute[] },
  );

  const renderSend = ({ item: send }: { item: SendWithRoute }) => (
    <TouchableOpacity
      style={[styles.sendItem, { backgroundColor: colors.cardBackground, borderBottomColor: colors.separator }]}
      onPress={() => navigation.navigate('RouteDetail', { routeId: send.route.id })}
    >
      <View style={styles.sendInfo}>
        <Text style={[styles.sendTitle, { color: colors.textPrimary }]}>{send.route.title}</Text>
        <View style={styles.sendMeta}>
          <Text style={[styles.sendGrade, { color: colors.primary }]}>{send.route.grade}</Text>
          {send.quality_rating && (
            <View style={styles.sendRating}>
              <Ionicons name="star" size={12} color={colors.star} />
              <Text style={[styles.sendRatingText, { color: colors.textSecondary }]}>{send.quality_rating}</Text>
            </View>
          )}
          {send.difficulty_rating !== null && (
            <Text style={[styles.sendDifficulty, { color: colors.textSecondary }]}>
              {getDifficultyLabel(send.difficulty_rating)}
            </Text>
          )}
        </View>
        <Text style={[styles.sendDate, { color: colors.textTertiary }]}>{formatRelativeDate(send.sent_at)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.chevron} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={sends}
      keyExtractor={(item) => item.id}
      renderItem={renderSend}
      contentContainerStyle={sends.length === 0 ? styles.emptyContainer : undefined}
      ListEmptyComponent={
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{emptyMessage || t('sends.noSendsYet')}</Text>
      }
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  sendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
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
  },
  sendRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sendRatingText: {
    fontSize: 12,
  },
  sendDifficulty: {
    fontSize: 12,
  },
  sendDate: {
    fontSize: 12,
  },
});
