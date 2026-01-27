import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Comment } from '../types/database.types';
import { commentsApi, userProfilesApi, cacheEvents } from '../lib/api';
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
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        Comments {comments.length > 0 && `(${comments.length})`}
      </Text>

      {loading ? (
        <ActivityIndicator size="small" color="#0066cc" style={styles.loader} />
      ) : (
        <>
          {comments.length === 0 ? (
            <Text style={styles.emptyText}>No comments yet</Text>
          ) : (
            <View style={styles.commentsList}>
              {comments.map((comment) => (
                <View key={comment.id} style={styles.comment}>
                  <View style={styles.commentHeader}>
                    <UserNameLink
                      userId={comment.user_id}
                      displayName={comment.displayName}
                      style={styles.commentAuthor}
                    />
                    <Text style={styles.commentDate}>
                      {formatRelativeDate(comment.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.commentText}>{comment.text}</Text>
                  {userId === comment.user_id && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(comment.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          <View style={styles.inputRow}>
            <TrimmedTextInput
              style={styles.input}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              placeholderTextColor="#999"
              multiline
              editable={!submitting}
              onFocus={onInputFocus}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!newComment.trim() || submitting) && styles.sendButtonDisabled]}
              onPress={handleSubmit}
              disabled={!newComment.trim() || submitting}
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
    backgroundColor: '#fff',
    marginTop: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#ddd',
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
    color: '#999',
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
    borderBottomColor: '#f0f0f0',
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
    color: '#333',
  },
  commentDate: {
    fontSize: 12,
    color: '#999',
  },
  commentText: {
    fontSize: 15,
    color: '#444',
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
    borderColor: '#ddd',
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
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});
