import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import { appConfigApi } from '../lib/api';
import { isVersionOutdated } from '../utils/version';
import { useAuth } from '../lib/auth-context';

export function useVersionCheck() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const { user } = useAuth();

  const checkVersion = useCallback(async () => {
    try {
      const minVersion = await appConfigApi.getMinVersion();
      const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
      setUpdateRequired(isVersionOutdated(currentVersion, minVersion));
    } catch {
      // Fail open — don't block the user on network errors
    }
  }, []);

  // Check on foreground
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        checkVersion();
      }
      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [checkVersion]);

  // Re-check on login/logout (also handles initial mount)
  useEffect(() => {
    if (Platform.OS === 'web') return;
    checkVersion();
  }, [user, checkVersion]);

  return { updateRequired };
}
