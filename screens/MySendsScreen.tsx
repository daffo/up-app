import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import UserSendsList from '../components/UserSendsList';
import SafeScreen from '../components/SafeScreen';

export default function MySendsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) {
    return <SafeScreen />;
  }

  return (
    <SafeScreen>
      <UserSendsList userId={user.id} emptyMessage={t('sends.noSendsYetStart')} />
    </SafeScreen>
  );
}
