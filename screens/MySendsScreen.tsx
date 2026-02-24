import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import { useThemeColors } from '../lib/theme-context';
import UserSendsList from '../components/UserSendsList';

export default function MySendsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const colors = useThemeColors();

  if (!user) {
    return <View style={[styles.container, { backgroundColor: colors.screenBackground }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.screenBackground }]}>
      <UserSendsList userId={user.id} emptyMessage={t('sends.noSendsYetStart')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
