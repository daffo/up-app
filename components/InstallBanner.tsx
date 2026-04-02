import { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.daffo.upapp';

export default function InstallBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (Platform.OS !== 'web' || dismissed) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.content}>
        <Text style={styles.emoji}>🧗</Text>
        <Text style={styles.text}>{t('installBanner.message')}</Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => Linking.openURL(PLAY_STORE_URL)}
        accessibilityLabel={t('installBanner.install')}
      >
        <Text style={styles.buttonText}>{t('installBanner.install')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.close}
        onPress={() => setDismissed(true)}
        accessibilityLabel={t('installBanner.dismiss')}
      >
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#0066cc',
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 24,
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  buttonText: {
    color: '#0066cc',
    fontSize: 13,
    fontWeight: '700',
  },
  close: {
    marginLeft: 8,
    padding: 4,
  },
  closeText: {
    color: 'white',
    fontSize: 20,
  },
});
