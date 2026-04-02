import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './lib/auth-context';
import { ThemeProvider, initTheme, useTheme } from './lib/theme-context';
import { initI18n } from './lib/i18n';
import { initImageDimensionsCache } from './lib/cache/image-cache';
import ErrorBoundary from './components/ErrorBoundary';
import AppNavigator from './navigation/AppNavigator';
import InstallBanner from './components/InstallBanner';
import ForceUpdateScreen from './screens/ForceUpdateScreen';
import { useVersionCheck } from './hooks/useVersionCheck';
import { useActivityTracker } from './hooks/useActivityTracker';

function AppContent() {
  const { isDark } = useTheme();
  const { updateRequired } = useVersionCheck();
  useActivityTracker();

  if (updateRequired) {
    return <ForceUpdateScreen />;
  }

  return (
    <>
      <InstallBanner />
      <AppNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([initI18n(), initTheme(), initImageDimensionsCache()]).then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
