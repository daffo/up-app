import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../lib/theme-context';

interface DraftBannerProps {
  onPublish: () => void;
  publishing?: boolean;
}

export default function DraftBanner({ onPublish, publishing = false }: DraftBannerProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <View style={[styles.banner, { backgroundColor: colors.primaryLightAlt }]}>
      <View style={styles.content}>
        <Ionicons name="document-text-outline" size={16} color={colors.warning} />
        <Text style={[styles.text, { color: colors.warning }]}>{t('route.draftBanner')}</Text>
      </View>
      <TouchableOpacity
        style={[styles.publishButton, { backgroundColor: colors.primary }, publishing && { opacity: 0.6 }]}
        onPress={onPublish}
        disabled={publishing}
      >
        {publishing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.publishButtonText}>{t('routeForm.publish')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    margin: 12,
    marginBottom: 0,
    borderRadius: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  publishButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
