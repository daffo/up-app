import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import TrimmedTextInput from '../components/TrimmedTextInput';
import { useAuth } from '../lib/auth-context';
import { userProfilesApi } from '../lib/api';
import { SUPPORTED_LANGUAGES, changeLanguage, getCurrentLanguage, LanguageCode } from '../lib/i18n';
import { useTheme, ThemePreference } from '../lib/theme-context';

const THEME_OPTIONS: { value: ThemePreference; labelKey: string; icon: string }[] = [
  { value: 'light', labelKey: 'account.themeLight', icon: '\u2600\uFE0F' },
  { value: 'dark', labelKey: 'account.themeDark', icon: '\uD83C\uDF19' },
  { value: 'system', labelKey: 'account.themeSystem', icon: '\uD83D\uDCF1' },
];

export default function MyAccountScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { user, deleteAccount } = useAuth();
  const { themePreference, setThemePreference, colors } = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentLang, setCurrentLang] = useState<LanguageCode>(getCurrentLanguage());

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      const profile = await userProfilesApi.get(user.id);
      if (profile?.display_name) {
        setDisplayName(profile.display_name);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      await userProfilesApi.upsert(user.id, { display_name: displayName.trim() || null });
      Alert.alert(t('common.success'), t('account.displayNameUpdated'));
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert(t('common.error'), t('account.failedToSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLanguageChange = async (langCode: LanguageCode) => {
    await changeLanguage(langCode);
    setCurrentLang(langCode);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('account.deleteAccountTitle'),
      t('account.deleteAccountMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('account.deleteAccountConfirmTitle'),
              t('account.deleteAccountConfirmMessage'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('account.deleteAccountButton'),
                  style: 'destructive',
                  onPress: async () => {
                    setIsDeleting(true);
                    const { error } = await deleteAccount();
                    if (error) {
                      setIsDeleting(false);
                      Alert.alert(t('common.error'), t('account.deleteAccountError'));
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.screenBackground }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.screenBackground }]} contentContainerStyle={styles.contentContainer}>
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('account.email')}</Text>
        <Text style={[styles.emailText, { color: colors.textPrimary }]}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('account.displayName')}</Text>
        <TrimmedTextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }]}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('account.displayNamePlaceholder')}
          placeholderTextColor={colors.placeholderText}
          autoCapitalize="words"
          accessibilityLabel={t('account.displayName')}
          maxLength={50}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, { backgroundColor: colors.primary }, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>
          {isSaving ? t('common.saving') : t('common.save')}
        </Text>
      </TouchableOpacity>

      <View style={styles.languageSection}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('account.language')}</Text>
        <View style={[styles.optionGroup, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.optionItem,
                { borderBottomColor: colors.separator },
                currentLang === lang.code && { backgroundColor: colors.primaryLightAlt },
              ]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: colors.textPrimary },
                  currentLang === lang.code && { color: colors.primary, fontWeight: '600' },
                ]}
              >
                {lang.flag}  {lang.nativeName}
              </Text>
              {currentLang === lang.code && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.themeSection}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('account.theme')}</Text>
        <View style={[styles.optionGroup, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          {THEME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionItem,
                { borderBottomColor: colors.separator },
                themePreference === option.value && { backgroundColor: colors.primaryLightAlt },
              ]}
              onPress={() => setThemePreference(option.value)}
            >
              <Text
                style={[
                  styles.optionText,
                  { color: colors.textPrimary },
                  themePreference === option.value && { color: colors.primary, fontWeight: '600' },
                ]}
              >
                {option.icon}  {t(option.labelKey)}
              </Text>
              {themePreference === option.value && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.deleteButton, { borderColor: colors.danger }, isDeleting && styles.saveButtonDisabled]}
        onPress={handleDeleteAccount}
        disabled={isDeleting}
      >
        <Text style={[styles.deleteButtonText, { color: colors.danger }]}>
          {isDeleting ? t('account.deleting') : t('account.deleteAccount')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  saveButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  languageSection: {
    marginTop: 8,
  },
  themeSection: {
    marginTop: 24,
  },
  optionGroup: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
  },
  deleteButton: {
    marginTop: 40,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center' as const,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
