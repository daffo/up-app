import React from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { authStyles } from './authStyles';

interface AuthLayoutProps {
  subtitle: string;
  children: React.ReactNode;
}

export default function AuthLayout({ subtitle, children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={authStyles.container}
    >
      <View style={authStyles.content}>
        <Text style={authStyles.title}>{t('home.title')}</Text>
        <Text style={authStyles.subtitle}>{subtitle}</Text>
        <View style={authStyles.form}>{children}</View>
      </View>
    </KeyboardAvoidingView>
  );
}
