import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import TrimmedTextInput from '../components/TrimmedTextInput';
import { useAuth } from '../lib/auth-context';
import { userProfilesApi } from '../lib/api';
import { SUPPORTED_LANGUAGES, changeLanguage, getCurrentLanguage, LanguageCode } from '../lib/i18n';

export default function MyAccountScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

    if (!displayName.trim()) {
      Alert.alert(t('common.error'), t('account.displayNameRequired'));
      return;
    }

    setIsSaving(true);
    try {
      await userProfilesApi.upsert(user.id, { display_name: displayName.trim() });
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

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>{t('account.email')}</Text>
        <Text style={styles.emailText}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t('account.displayName')}</Text>
        <TrimmedTextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('account.displayNamePlaceholder')}
          autoCapitalize="words"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>
          {isSaving ? t('common.saving') : t('common.save')}
        </Text>
      </TouchableOpacity>

      <View style={styles.languageSection}>
        <Text style={styles.label}>{t('account.language')}</Text>
        <View style={styles.languageOptions}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageOption,
                currentLang === lang.code && styles.languageOptionSelected,
              ]}
              onPress={() => handleLanguageChange(lang.code)}
            >
              <Text
                style={[
                  styles.languageOptionText,
                  currentLang === lang.code && styles.languageOptionTextSelected,
                ]}
              >
                {lang.flag}  {lang.nativeName}
              </Text>
              {currentLang === lang.code && (
                <Ionicons name="checkmark" size={20} color="#0066cc" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#0066cc',
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
  languageOptions: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  languageOptionSelected: {
    backgroundColor: '#f0f7ff',
  },
  languageOptionText: {
    fontSize: 16,
    color: '#333',
  },
  languageOptionTextSelected: {
    color: '#0066cc',
    fontWeight: '600',
  },
});
