import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { AppNavigationProp } from '../navigation/types';
import { sendsApi } from '../lib/api';
import { Send } from '../types/database.types';
import { useThemeColors } from '../lib/theme-context';
import { formatRelativeDate } from '../utils/date';
import { getDifficultyLabel } from '../utils/sends';
import ListItemWithRoute from './ListItemWithRoute';
import DataListView from './DataListView';
import { useApiQuery } from '../hooks/useApiQuery';

type SendWithRoute = Send & { route: { id: string; title: string; grade: string } };

interface UserSendsListProps {
  userId: string;
  emptyMessage?: string;
}

export default function UserSendsList({ userId, emptyMessage }: UserSendsListProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const navigation = useNavigation<AppNavigationProp>();
  const { data: sends, loading, refreshing, refresh } = useApiQuery(
    () => sendsApi.listByUser(userId),
    [userId],
    { cacheKey: 'sends', initialData: [] as SendWithRoute[] },
  );

  const renderSend = ({ item: send }: { item: SendWithRoute }) => (
    <ListItemWithRoute
      title={send.route.title}
      titleStyle={styles.sendTitle}
      headerStyle={styles.sendHeader}
      metadata={
        <>
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
        </>
      }
      onPress={() => navigation.navigate('RouteDetail', { routeId: send.route.id })}
      chevronPosition="inline"
    />
  );

  return (
    <DataListView
      loading={loading}
      data={sends}
      emptyMessage={emptyMessage || t('sends.noSendsYet')}
      keyExtractor={(item) => item.id}
      renderItem={renderSend}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}

const styles = StyleSheet.create({
  sendTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  sendHeader: {
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
