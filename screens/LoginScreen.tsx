import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import TrimmedTextInput from '../components/TrimmedTextInput';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuthStyles } from '../components/auth/authStyles';

export default function LoginScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle, signInWithFacebook } = useAuth();
  const { redirectTo } = route.params || {};
  const { styles, colors } = useAuthStyles();

  const handleLoginSuccess = () => {
    navigation.replace(redirectTo || 'Home');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.errorFillFields'));
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert(t('auth.loginFailed'), error.message);
    } else {
      handleLoginSuccess();
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);

    if (error) {
      Alert.alert(t('auth.loginFailed'), error.message);
    } else {
      handleLoginSuccess();
    }
  };

  const handleFacebookLogin = async () => {
    setLoading(true);
    const { error } = await signInWithFacebook();
    setLoading(false);

    if (error) {
      Alert.alert(t('auth.loginFailed'), error.message);
    } else {
      handleLoginSuccess();
    }
  };

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

      <TextInput
        style={styles.input}
        placeholder={t('auth.password')}
        placeholderTextColor={colors.placeholderText}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
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
