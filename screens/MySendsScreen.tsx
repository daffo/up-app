import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import UserSendsList from '../components/UserSendsList';

export default function MySendsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <UserSendsList userId={user.id} emptyMessage={t('sends.noSendsYetStart')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
