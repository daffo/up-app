import React from 'react';
import {
  Text,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import { commentsApi } from '../lib/api';
import { Comment } from '../types/database.types';
import { useThemeColors } from '../lib/theme-context';
import { formatRelativeDate } from '../utils/date';
import SafeScreen from '../components/SafeScreen';
import ListItemWithRoute from '../components/ListItemWithRoute';
import DataListView from '../components/DataListView';
import { useApiQuery } from '../hooks/useApiQuery';
import { ScreenProps } from '../navigation/types';

type CommentWithRoute = Comment & { route: { id: string; title: string; grade: string } };

export default function MyCommentsScreen({ navigation }: ScreenProps<'MyComments'>) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const colors = useThemeColors();
  const { data: comments, loading, refreshing, refresh } = useApiQuery(
    () => commentsApi.listByUser(user!.id),
    [user?.id],
    { cacheKey: 'comments', enabled: !!user, initialData: [] as CommentWithRoute[] },
  );

  const renderComment = ({ item: comment }: { item: CommentWithRoute }) => (
    <ListItemWithRoute
      title={comment.route.title}
      titleRight={
        <Text style={[styles.routeGrade, { color: colors.primary }]}>{comment.route.grade}</Text>
      }
      subtitle={comment.text}
      metadata={
        <Text style={[styles.commentDate, { color: colors.textTertiary }]}>
          {formatRelativeDate(comment.created_at)}
        </Text>
      }
      onPress={() => navigation.navigate('RouteDetail', { routeId: comment.route.id })}
    />
  );

  return (
    <SafeScreen>
      <DataListView
        loading={loading}
        data={comments}
        emptyMessage={t('comments.noCommentsYet')}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        loadingStyle={{ backgroundColor: colors.screenBackground }}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  routeGrade: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentDate: {
    fontSize: 12,
  },
});
