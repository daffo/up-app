import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../lib/auth-context';
import TrimmedTextInput from '../components/TrimmedTextInput';
import AuthLayout from '../components/auth/AuthLayout';
import { authStyles } from '../components/auth/authStyles';

export default function LoginScreen({ navigation, route }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const { redirectTo } = route.params || {};

  const handleLoginSuccess = () => {
    navigation.replace(redirectTo || 'Home');
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Login Failed', error.message);
    } else {
      handleLoginSuccess();
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    setLoading(false);

    if (error) {
      Alert.alert('Login Failed', error.message);
    } else {
      handleLoginSuccess();
    }
  };

  return (
    <AuthLayout subtitle="Climbing Gym Route Tracker">
      <TrimmedTextInput
        style={authStyles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />

      <TextInput
        style={authStyles.input}
        placeholder="Password"
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
          {loading ? 'Logging in...' : 'Log In'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.linkButton}
        onPress={() => navigation.navigate('Signup')}
        disabled={loading}
      >
        <Text style={authStyles.linkText}>
          Don't have an account? Sign up
        </Text>
      </TouchableOpacity>

      <View style={authStyles.divider}>
        <View style={authStyles.dividerLine} />
        <Text style={authStyles.dividerText}>or continue with</Text>
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
    </AuthLayout>
  );
}
