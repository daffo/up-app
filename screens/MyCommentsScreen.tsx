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
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import { commentsApi, cacheEvents } from '../lib/api';
import { Comment } from '../types/database.types';
import { useThemeColors } from '../lib/theme-context';
import { formatRelativeDate } from '../utils/date';

type CommentWithRoute = Comment & { route: { id: string; title: string; grade: string } };

export default function MyCommentsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const colors = useThemeColors();
  const [comments, setComments] = useState<CommentWithRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadComments();
      const unsubscribe = cacheEvents.subscribe('comments', loadComments);
      return unsubscribe;
    }
  }, [user]);

  const loadComments = async () => {
    if (!user) return;
    try {
      const data = await commentsApi.listByUser(user.id);
      setComments(data);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadComments();
  };

  const renderComment = ({ item: comment }: { item: CommentWithRoute }) => (
    <TouchableOpacity
      style={[styles.commentItem, { backgroundColor: colors.cardBackground, borderBottomColor: colors.separator }]}
      onPress={() => navigation.navigate('RouteDetail', { routeId: comment.route.id })}
    >
      <View style={styles.commentHeader}>
        <Text style={[styles.routeTitle, { color: colors.textPrimary }]}>{comment.route.title}</Text>
        <Text style={[styles.routeGrade, { color: colors.primary }]}>{comment.route.grade}</Text>
      </View>
      <Text style={[styles.commentText, { color: colors.textSecondary }]} numberOfLines={2}>
        {comment.text}
      </Text>
      <Text style={[styles.commentDate, { color: colors.textTertiary }]}>{formatRelativeDate(comment.created_at)}</Text>
      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color={colors.chevron} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.screenBackground }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.screenBackground }]}>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        contentContainerStyle={comments.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('comments.noCommentsYet')}</Text>
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
  },
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
  commentItem: {
    padding: 16,
    borderBottomWidth: 1,
    position: 'relative',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  routeGrade: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
    paddingRight: 24,
  },
  commentDate: {
    fontSize: 12,
  },
  chevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
});
