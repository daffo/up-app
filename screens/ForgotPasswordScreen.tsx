import { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import TrimmedTextInput from '../components/TrimmedTextInput';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuthStyles } from '../components/auth/authStyles';
import { ScreenProps } from '../navigation/types';

export default function ForgotPasswordScreen({ navigation }: ScreenProps<'ForgotPassword'>) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { styles, colors } = useAuthStyles();

  const handleSendLink = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('auth.errorFillFields'));
      return;
    }

    setLoading(true);

    const redirectTo = Platform.OS === 'web'
      ? `${window.location.origin}/reset-password`
      : 'upapp:///reset-password';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <AuthLayout subtitle={t('forgotPassword.checkEmail')}>
        <Text style={[styles.linkText, { textAlign: 'center', fontSize: 16, lineHeight: 24 }]}>
          {t('forgotPassword.checkEmailMessage', { email })}
        </Text>

        <TouchableOpacity
          style={[styles.button, { marginTop: 24 }]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>
            {t('forgotPassword.backToLogin')}
          </Text>
        </TouchableOpacity>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout subtitle={t('forgotPassword.subtitle')}>
      <TrimmedTextInput
        style={styles.input}
        placeholder={t('auth.email')}
        placeholderTextColor={colors.placeholderText}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
        accessibilityLabel={t('auth.email')}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSendLink}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? t('forgotPassword.sending') : t('forgotPassword.sendLink')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => navigation.goBack()}
        disabled={loading}
      >
        <Text style={styles.linkText}>
          {t('forgotPassword.backToLogin')}
        </Text>
      </TouchableOpacity>
    </AuthLayout>
  );
}
