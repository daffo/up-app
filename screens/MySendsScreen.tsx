import React from 'react';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import { useThemeColors } from '../lib/theme-context';
import UserSendsList from '../components/UserSendsList';
import SafeScreen from '../components/SafeScreen';

export default function MySendsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const colors = useThemeColors();

  if (!user) {
    return <SafeScreen />;
  }

  return (
    <SafeScreen>
      <UserSendsList userId={user.id} emptyMessage={t('sends.noSendsYetStart')} />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
