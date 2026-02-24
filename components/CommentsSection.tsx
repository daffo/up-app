import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Comment } from '../types/database.types';
import { commentsApi, userProfilesApi, cacheEvents } from '../lib/api';
import { useThemeColors } from '../lib/theme-context';
import TrimmedTextInput from './TrimmedTextInput';
import UserNameLink from './UserNameLink';
import { formatRelativeDate } from '../utils/date';

interface CommentWithProfile extends Comment {
  displayName?: string;
}

interface CommentsSectionProps {
  routeId: string;
  userId?: string;
  onLoginRequired: () => void;
  onInputFocus?: () => void;
}

export default function CommentsSection({ routeId, userId, onLoginRequired, onInputFocus }: CommentsSectionProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
    const unsubscribe = cacheEvents.subscribe('comments', fetchComments);
    return unsubscribe;
  }, [routeId]);

  const fetchComments = async () => {
    try {
      const data = await commentsApi.listByRoute(routeId);

      // Fetch display names for all unique user IDs
      const userIds = [...new Set(data.map(c => c.user_id))];
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

      setComments(
        data.map(c => ({
          ...c,
          displayName: profileMap.get(c.user_id) || undefined,
        }))
      );
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!userId) {
      onLoginRequired();
      return;
    }
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      await commentsApi.create({
        user_id: userId,
        route_id: routeId,
        text: newComment.trim(),
      });
      setNewComment('');
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await commentsApi.delete(commentId);
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {comments.length > 0 ? t('comments.titleWithCount', { count: comments.length }) : t('comments.title')}
      </Text>

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
      ) : (
        <>
          {comments.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>{t('comments.noCommentsYet')}</Text>
          ) : (
            <View style={styles.commentsList}>
              {comments.map((comment) => (
                <View key={comment.id} style={[styles.comment, { borderBottomColor: colors.separator }]}>
                  <View style={styles.commentHeader}>
                    <UserNameLink
                      userId={comment.user_id}
                      displayName={comment.displayName}
                      style={[styles.commentAuthor, { color: colors.textPrimary }]}
                    />
                    <Text style={[styles.commentDate, { color: colors.textTertiary }]}>
                      {formatRelativeDate(comment.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.commentText, { color: colors.textSecondary }]}>{comment.text}</Text>
                  {userId === comment.user_id && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(comment.id)}
                      accessibilityLabel={t('comments.deleteComment')}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.inputRow}>
            <TrimmedTextInput
              style={[styles.input, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
              value={newComment}
              onChangeText={setNewComment}
              placeholder={t('comments.addComment')}
              placeholderTextColor={colors.placeholderText}
              multiline
              editable={!submitting}
              onFocus={onInputFocus}
              accessibilityLabel={t('comments.addComment')}
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: colors.primary }, (!newComment.trim() || submitting) && { backgroundColor: colors.disabledButton }]}
              onPress={handleSubmit}
              disabled={!newComment.trim() || submitting}
              accessibilityLabel={t('comments.title')}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  loader: {
    marginVertical: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginVertical: 16,
  },
  commentsList: {
    marginBottom: 16,
  },
  comment: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    position: 'relative',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentDate: {
    fontSize: 12,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 20,
  },
  deleteButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
