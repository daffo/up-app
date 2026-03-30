import { useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { useNavigation } from '@react-navigation/native';
import { AppNavigationProp, RootStackParamList } from '../navigation/types';

/**
 * Hook that guards admin-only screens.
 * If the user is not an admin, navigates to the fallback route.
 */
export function useRequireAdmin(fallbackRoute: keyof RootStackParamList = 'Home') {
  const { isAdmin, loading } = useAuth();
  const navigation = useNavigation<AppNavigationProp>();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigation.navigate(fallbackRoute as any);
    }
  }, [isAdmin, loading, navigation, fallbackRoute]);

  return { isAdmin, loading };
}
