import { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useAuth } from '../lib/auth-context';
import TrimmedTextInput from '../components/TrimmedTextInput';
import AuthLayout from '../components/auth/AuthLayout';
import { authStyles } from '../components/auth/authStyles';

export default function SignupScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Signup Failed', error.message);
    } else {
      Alert.alert(
        'Success',
        'Account created! Please check your email to confirm your account.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    }
  };

  return (
    <AuthLayout subtitle="Create Your Account">
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
        placeholder="Password (min 6 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />

      <TextInput
        style={authStyles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!loading}
      />

      <TouchableOpacity
        style={[authStyles.button, loading && authStyles.buttonDisabled]}
        onPress={handleSignup}
        disabled={loading}
      >
        <Text style={authStyles.buttonText}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.linkButton}
        onPress={() => navigation.navigate('Login')}
        disabled={loading}
      >
        <Text style={authStyles.linkText}>
          Already have an account? Log in
        </Text>
      </TouchableOpacity>
    </AuthLayout>
  );
}
