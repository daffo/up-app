import { useAuth } from '../lib/auth-context';
import { useNavigation } from '@react-navigation/native';

/**
 * Hook that provides a function to wrap actions requiring authentication.
 * If user is not logged in, navigates to Login screen with redirect.
 * If user is logged in, executes the action immediately.
 */
export function useRequireAuth() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();

  /**
   * Wrap an action that requires authentication.
   * @param action - Function to execute if authenticated
   * @param redirectTo - Screen to redirect to after login (optional)
   */
  const requireAuth = (action: () => void, redirectTo?: string) => {
    if (!user) {
      navigation.navigate('Login', { redirectTo });
    } else {
      action();
    }
  };

  return { user, signOut, requireAuth };
}
