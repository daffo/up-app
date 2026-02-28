import React from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStyles } from './authStyles';
import SafeScreen from '../SafeScreen';

interface AuthLayoutProps {
  subtitle: string;
  children: React.ReactNode;
}

export default function AuthLayout({ subtitle, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  const { styles } = useAuthStyles();

  return (
    <SafeScreen hasHeader={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text style={styles.title}>{t('home.title')}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.form}>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}
