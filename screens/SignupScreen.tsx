import { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';
import TrimmedTextInput from '../components/TrimmedTextInput';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuthStyles } from '../components/auth/authStyles';

export default function SignupScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const { styles, colors } = useAuthStyles();

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert(t('common.error'), t('auth.errorFillFields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth.errorPasswordMatch'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.error'), t('auth.errorPasswordLength'));
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);

    if (error) {
      Alert.alert(t('auth.signupFailed'), error.message);
    } else {
      Alert.alert(
        t('common.success'),
        t('auth.signupSuccess'),
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    }
  };

  return (
    <AuthLayout subtitle={t('auth.createAccount')}>
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

      <TextInput
        style={styles.input}
        placeholder={t('auth.passwordMin')}
        placeholderTextColor={colors.placeholderText}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
        accessibilityLabel={t('auth.password')}
      />

      <TextInput
        style={styles.input}
        placeholder={t('auth.confirmPassword')}
        placeholderTextColor={colors.placeholderText}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!loading}
        accessibilityLabel={t('auth.confirmPassword')}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSignup}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? t('auth.creatingAccount') : t('auth.signUp')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => navigation.navigate('Login')}
        disabled={loading}
      >
        <Text style={styles.linkText}>
          {t('auth.hasAccount')}
        </Text>
      </TouchableOpacity>
    </AuthLayout>
  );
}
