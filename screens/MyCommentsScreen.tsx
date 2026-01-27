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
import { commentsApi, cacheEvents } from '../lib/api';
import { Comment } from '../types/database.types';
import { formatRelativeDate } from '../utils/date';

type CommentWithRoute = Comment & { route: { id: string; title: string; grade: string } };

export default function MyCommentsScreen({ navigation }: any) {
  const { user } = useAuth();
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
      style={styles.commentItem}
      onPress={() => navigation.navigate('RouteDetail', { routeId: comment.route.id })}
    >
      <View style={styles.commentHeader}>
        <Text style={styles.routeTitle}>{comment.route.title}</Text>
        <Text style={styles.routeGrade}>{comment.route.grade}</Text>
      </View>
      <Text style={styles.commentText} numberOfLines={2}>
        {comment.text}
      </Text>
      <Text style={styles.commentDate}>{formatRelativeDate(comment.created_at)}</Text>
      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </View>
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
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        contentContainerStyle={comments.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No comments yet</Text>
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
  commentItem: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
    color: '#333',
  },
  routeGrade: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
  },
  commentText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
    paddingRight: 24,
  },
  commentDate: {
    fontSize: 12,
    color: '#999',
  },
  chevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
});
