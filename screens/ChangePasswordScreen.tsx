import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import PasswordInput from '../components/auth/PasswordInput';
import SafeScreen from '../components/SafeScreen';
import { useThemeColors } from '../lib/theme-context';
import { ScreenProps } from '../navigation/types';

export default function ChangePasswordScreen({ navigation }: ScreenProps<'ChangePassword'>) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('common.error'), t('auth.errorFillFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth.errorPasswordMatch'));
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(t('common.error'), t('auth.errorPasswordLength'));
      return;
    }

    setLoading(true);

    // Verify current password by re-authenticating
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPassword,
    });

    if (signInError || !data.session) {
      setLoading(false);
      Alert.alert(t('common.error'), t('changePassword.currentPasswordWrong'));
      return;
    }

    // Update to new password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (updateError) {
      Alert.alert(t('common.error'), updateError.message);
    } else {
      await supabase.auth.signOut({ scope: 'global' });
      Alert.alert(t('common.success'), t('changePassword.success'), [
        {
          text: 'OK',
          onPress: () => {
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ]);
    }
  };

  return (
    <SafeScreen>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.screenBackground }]}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t('changePassword.currentPassword')}
        </Text>
        <PasswordInput
          placeholder={t('changePassword.currentPassword')}
          placeholderTextColor={colors.placeholderText}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          editable={!loading}
          accessibilityLabel={t('changePassword.currentPassword')}
        />

        <View style={styles.spacer} />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t('changePassword.newPassword')}
        </Text>
        <PasswordInput
          placeholder={t('changePassword.newPasswordMin')}
          placeholderTextColor={colors.placeholderText}
          value={newPassword}
          onChangeText={setNewPassword}
          editable={!loading}
          accessibilityLabel={t('changePassword.newPassword')}
        />

        <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>
          {t('changePassword.confirmNewPassword')}
        </Text>
        <PasswordInput
          placeholder={t('changePassword.confirmNewPassword')}
          placeholderTextColor={colors.placeholderText}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          editable={!loading}
          accessibilityLabel={t('changePassword.confirmNewPassword')}
        />

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
            {loading ? t('changePassword.updating') : t('changePassword.updatePassword')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  spacer: {
    height: 24,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
