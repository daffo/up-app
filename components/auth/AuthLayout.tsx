import React from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { authStyles } from './authStyles';

interface AuthLayoutProps {
  subtitle: string;
  children: React.ReactNode;
}

export default function AuthLayout({ subtitle, children }: AuthLayoutProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={authStyles.container}
    >
      <View style={authStyles.content}>
        <Text style={authStyles.title}>Up App</Text>
        <Text style={authStyles.subtitle}>{subtitle}</Text>
        <View style={authStyles.form}>{children}</View>
      </View>
    </KeyboardAvoidingView>
  );
}
