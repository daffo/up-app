import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './lib/auth-context';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
