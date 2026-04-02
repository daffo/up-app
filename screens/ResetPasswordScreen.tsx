import { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import PasswordInput from '../components/auth/PasswordInput';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuthStyles } from '../components/auth/authStyles';
import { ScreenProps } from '../navigation/types';

export default function ResetPasswordScreen({ navigation }: ScreenProps<'ResetPassword'>) {
  const { t } = useTranslation();
  const { clearPasswordRecovery } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { styles, colors } = useAuthStyles();

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
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

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      clearPasswordRecovery();
      await supabase.auth.signOut({ scope: 'global' });
      Alert.alert(t('common.success'), t('resetPassword.success'), [
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
    <AuthLayout subtitle={t('resetPassword.subtitle')}>
      <PasswordInput
        placeholder={t('resetPassword.newPasswordMin')}
        placeholderTextColor={colors.placeholderText}
        value={newPassword}
        onChangeText={setNewPassword}
        editable={!loading}
        accessibilityLabel={t('resetPassword.newPassword')}
      />

      <PasswordInput
        placeholder={t('resetPassword.confirmPassword')}
        placeholderTextColor={colors.placeholderText}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!loading}
        accessibilityLabel={t('resetPassword.confirmPassword')}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleReset}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? t('resetPassword.resetting') : t('resetPassword.resetButton')}
        </Text>
      </TouchableOpacity>
    </AuthLayout>
  );
}
