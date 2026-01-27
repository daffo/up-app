import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { userProfilesApi } from '../lib/api';
import UserSendsList from '../components/UserSendsList';

export default function UserProfileScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  useEffect(() => {
    if (!loading) {
      navigation.setOptions({ title: displayName || 'Anonymous' });
    }
  }, [displayName, loading, navigation]);

  const loadProfile = async () => {
    try {
      const profile = await userProfilesApi.get(userId);
      setDisplayName(profile?.display_name || null);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Sends</Text>
      <UserSendsList userId={userId} emptyMessage="No sends yet" />
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
});
