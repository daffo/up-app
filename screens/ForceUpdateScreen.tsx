import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../lib/theme-context';

const STORE_URL =
  Platform.OS === 'ios'
    ? '' // TODO: Add App Store URL when available
    : 'https://play.google.com/store/apps/details?id=com.daffo.upapp';

export default function ForceUpdateScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.screenBackground }]}>
      <View style={styles.content}>
        <Ionicons name="arrow-up-circle-outline" size={80} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('forceUpdate.title')}
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {t('forceUpdate.message')}
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => Linking.openURL(STORE_URL)}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
            {t('forceUpdate.updateButton')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 24,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    marginTop: 32,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
