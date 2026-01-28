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
import { authStyles } from '../components/auth/authStyles';

export default function SignupScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

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
        style={authStyles.input}
        placeholder={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
        accessibilityLabel={t('auth.email')}
      />

      <TextInput
        style={authStyles.input}
        placeholder={t('auth.passwordMin')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
        accessibilityLabel={t('auth.password')}
      />

      <TextInput
        style={authStyles.input}
        placeholder={t('auth.confirmPassword')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!loading}
        accessibilityLabel={t('auth.confirmPassword')}
      />

      <TouchableOpacity
        style={[authStyles.button, loading && authStyles.buttonDisabled]}
        onPress={handleSignup}
        disabled={loading}
      >
        <Text style={authStyles.buttonText}>
          {loading ? t('auth.creatingAccount') : t('auth.signUp')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.linkButton}
        onPress={() => navigation.navigate('Login')}
        disabled={loading}
      >
        <Text style={authStyles.linkText}>
          {t('auth.hasAccount')}
        </Text>
      </TouchableOpacity>
    </AuthLayout>
  );
}
