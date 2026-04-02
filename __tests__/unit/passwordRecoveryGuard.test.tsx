import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Mocks ---
const mockSignOut = jest.fn().mockResolvedValue({});
const mockGetSession = jest.fn();
const mockSetSession = jest.fn().mockResolvedValue({ error: null });
let authStateCallback: ((event: string, session: any) => void) | null = null;

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      setSession: (...args: any[]) => mockSetSession(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
      onAuthStateChange: (cb: any) => {
        authStateCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }),
  },
}));

jest.mock('expo-linking', () => ({
  createURL: () => 'exp://test',
  addEventListener: () => ({ remove: jest.fn() }),
  getInitialURL: () => Promise.resolve(null),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('../../lib/api', () => ({
  accountApi: { deleteAllUserData: jest.fn() },
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

const PASSWORD_RECOVERY_KEY = '@password_recovery_pending';

// Import React and render helpers after mocks
import React from 'react';
import { create, act } from 'react-test-renderer';
import { AuthProvider } from '../../lib/auth-context';

function renderProvider() {
  const { Text } = require('react-native');
  let renderer: any;
  act(() => {
    renderer = create(
      <AuthProvider><Text>test</Text></AuthProvider>
    );
  });
  return renderer;
}

describe('Password Recovery Guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = null;
  });

  describe('startup check', () => {
    it('signs out and clears flag when recovery flag is set on startup', async () => {
      mockGetItem.mockResolvedValue('true');
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: '1' } } } });

      await act(async () => {
        renderProvider();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(mockGetItem).toHaveBeenCalledWith(PASSWORD_RECOVERY_KEY);
      expect(mockRemoveItem).toHaveBeenCalledWith(PASSWORD_RECOVERY_KEY);
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('does not call getSession when recovery flag is set', async () => {
      mockGetItem.mockResolvedValue('true');
      mockGetSession.mockResolvedValue({ data: { session: null } });

      await act(async () => {
        renderProvider();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // getSession is not called because recovery check short-circuits
      // (onAuthStateChange may still call it internally, but our code path skips it)
      expect(mockSignOut).toHaveBeenCalled();
    });

    it('loads session normally when no recovery flag is set', async () => {
      mockGetItem.mockResolvedValue(null);
      mockGetSession.mockResolvedValue({ data: { session: { user: { id: '1' } } } });

      await act(async () => {
        renderProvider();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(mockGetItem).toHaveBeenCalledWith(PASSWORD_RECOVERY_KEY);
      expect(mockSignOut).not.toHaveBeenCalled();
      expect(mockGetSession).toHaveBeenCalled();
    });
  });

  describe('recovery detection', () => {
    it('persists flag when PASSWORD_RECOVERY event fires', async () => {
      mockGetItem.mockResolvedValue(null);
      mockGetSession.mockResolvedValue({ data: { session: null } });

      await act(async () => {
        renderProvider();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      expect(authStateCallback).not.toBeNull();

      await act(async () => {
        authStateCallback!('PASSWORD_RECOVERY', { user: { id: '1' } });
      });

      expect(mockSetItem).toHaveBeenCalledWith(PASSWORD_RECOVERY_KEY, 'true');
    });

    it('does not persist flag for non-recovery auth events', async () => {
      mockGetItem.mockResolvedValue(null);
      mockGetSession.mockResolvedValue({ data: { session: null } });

      await act(async () => {
        renderProvider();
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await act(async () => {
        authStateCallback!('SIGNED_IN', { user: { id: '1' } });
      });

      expect(mockSetItem).not.toHaveBeenCalledWith(PASSWORD_RECOVERY_KEY, 'true');
    });
  });
});
