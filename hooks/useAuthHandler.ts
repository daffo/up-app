import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

type AuthResult = { error: { message: string } | null };

export function useAuthHandler() {
  const [loading, setLoading] = useState(false);

  const handleAuth = useCallback(async (
    authFn: () => Promise<AuthResult>,
    failedTitle: string,
    onSuccess: () => void,
  ) => {
    setLoading(true);
    const { error } = await authFn();
    setLoading(false);

    if (error) {
      Alert.alert(failedTitle, error.message);
    } else {
      onSuccess();
    }
  }, []);

  return { loading, handleAuth };
}
