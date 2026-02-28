import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { userProfilesApi } from '../lib/api';
import { useThemeColors } from '../lib/theme-context';
import UserSendsList from '../components/UserSendsList';
import SafeScreen from '../components/SafeScreen';

export default function UserProfileScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { userId } = route.params;
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  useEffect(() => {
    if (!loading) {
      navigation.setOptions({ title: displayName || t('common.anonymous') });
    }
  }, [displayName, loading, navigation, t]);

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
      <View style={[styles.loadingContainer, { backgroundColor: colors.screenBackground }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeScreen>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('sends.title')}</Text>
      <UserSendsList userId={userId} emptyMessage={t('sends.noSendsYet')} />
    </SafeScreen>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
});
