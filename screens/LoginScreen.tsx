import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import TrimmedTextInput from '../components/TrimmedTextInput';
import PasswordInput from '../components/auth/PasswordInput';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuthStyles } from '../components/auth/authStyles';
import { ScreenProps } from '../navigation/types';
import { useAuthHandler } from '../hooks/useAuthHandler';

export default function LoginScreen({ navigation, route }: ScreenProps<'Login'>) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, signInWithGoogle, signInWithFacebook } = useAuth();
  const { redirectTo } = route.params || {};
  const { styles, colors } = useAuthStyles();
  const { loading, handleAuth } = useAuthHandler();

  const onSuccess = () => {
    (navigation as { replace: (screen: string) => void }).replace(redirectTo || 'Home');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.errorFillFields'));
      return;
    }
    handleAuth(() => signIn(email, password), t('auth.loginFailed'), onSuccess);
  };

  const handleGoogleLogin = () =>
    handleAuth(() => signInWithGoogle(), t('auth.loginFailed'), onSuccess);

  const handleFacebookLogin = () =>
    handleAuth(() => signInWithFacebook(), t('auth.loginFailed'), onSuccess);

  return (
    <AuthLayout subtitle={t('auth.subtitle')}>
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

      <PasswordInput
        placeholder={t('auth.password')}
        placeholderTextColor={colors.placeholderText}
        value={password}
        onChangeText={setPassword}
        editable={!loading}
        accessibilityLabel={t('auth.password')}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? t('auth.loggingIn') : t('auth.logIn')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => navigation.navigate('ForgotPassword')}
        disabled={loading}
      >
        <Text style={styles.linkText}>
          {t('auth.forgotPassword')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => navigation.navigate('Signup')}
        disabled={loading}
      >
        <Text style={styles.linkText}>
          {t('auth.noAccount')}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[styles.googleButton, loading && styles.buttonDisabled]}
        onPress={handleGoogleLogin}
        disabled={loading}
      >
        <FontAwesome name="google" size={20} color="#4285F4" />
        <Text style={styles.googleButtonText}>Google</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.googleButton, loading && styles.buttonDisabled]}
        onPress={handleFacebookLogin}
        disabled={loading}
      >
        <FontAwesome name="instagram" size={20} color="#E4405F" />
        <Text style={styles.googleButtonText}>Instagram/Facebook</Text>
      </TouchableOpacity>
    </AuthLayout>
  );
}
