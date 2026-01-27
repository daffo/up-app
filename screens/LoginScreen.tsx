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
import { authStyles } from '../components/auth/authStyles';

export default function LoginScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle, signInWithFacebook } = useAuth();
  const { redirectTo } = route.params || {};

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
        style={authStyles.input}
        placeholder={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />

      <TextInput
        style={authStyles.input}
        placeholder={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity
        style={[authStyles.button, loading && authStyles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={authStyles.buttonText}>
          {loading ? t('auth.loggingIn') : t('auth.logIn')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.linkButton}
        onPress={() => navigation.navigate('Signup')}
        disabled={loading}
      >
        <Text style={authStyles.linkText}>
          {t('auth.noAccount')}
        </Text>
      </TouchableOpacity>

      <View style={authStyles.divider}>
        <View style={authStyles.dividerLine} />
        <Text style={authStyles.dividerText}>{t('auth.orContinueWith')}</Text>
        <View style={authStyles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[authStyles.googleButton, loading && authStyles.buttonDisabled]}
        onPress={handleGoogleLogin}
        disabled={loading}
      >
        <FontAwesome name="google" size={20} color="#4285F4" />
        <Text style={authStyles.googleButtonText}>Google</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[authStyles.googleButton, loading && authStyles.buttonDisabled]}
        onPress={handleFacebookLogin}
        disabled={loading}
      >
        <FontAwesome name="instagram" size={20} color="#E4405F" />
        <Text style={authStyles.googleButtonText}>Instagram/Facebook</Text>
      </TouchableOpacity>
    </AuthLayout>
  );
}
