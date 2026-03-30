import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Alert, TouchableOpacity } from 'react-native';

// --- Supabase mock ---
const mockSignInWithPassword = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      updateUser: (...args: any[]) => mockUpdateUser(...args),
      signOut: (...args: any[]) => mockSignOut(...args),
    },
  },
}));

// --- Other mocks ---
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../lib/theme-context', () => ({
  useThemeColors: () => ({
    screenBackground: '#fff',
    inputBackground: '#fff',
    border: '#ccc',
    textPrimary: '#000',
    textSecondary: '#666',
    textTertiary: '#999',
    textOnPrimary: '#fff',
    placeholderText: '#aaa',
    primary: '#007AFF',
  }),
}));

jest.mock('../../lib/auth-context', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com' },
  }),
}));

jest.mock('../../components/SafeScreen', () => {
  const { View } = require('react-native');
  return ({ children }: any) => <View>{children}</View>;
});

jest.mock('../../components/auth/PasswordInput', () => {
  const { TextInput } = require('react-native');
  return (props: any) => <TextInput {...props} />;
});

jest.mock('../../components/auth/authStyles', () => ({
  useAuthStyles: () => ({
    styles: { passwordContainer: {}, passwordInput: {}, eyeButton: {} },
    colors: { textTertiary: '#999', placeholderText: '#aaa' },
  }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

import ChangePasswordScreen from '../../screens/ChangePasswordScreen';

const mockNavigation = {
  reset: jest.fn(),
  goBack: jest.fn(),
} as any;

const mockRoute = { key: 'test', name: 'ChangePassword' as const } as any;

function renderScreen() {
  let tree: ReactTestRenderer;
  act(() => {
    tree = create(
      <ChangePasswordScreen navigation={mockNavigation} route={mockRoute} />,
    );
  });
  return tree!;
}

function getTextInputs(tree: ReactTestRenderer) {
  const { TextInput } = require('react-native');
  return tree.root.findAllByType(TextInput);
}

function fillPasswordFields(tree: ReactTestRenderer, current: string, newPw: string, confirm: string) {
  const inputs = getTextInputs(tree);
  // Inputs in order: currentPassword, newPassword, confirmPassword
  act(() => { inputs[0].props.onChangeText(current); });
  act(() => { inputs[1].props.onChangeText(newPw); });
  act(() => { inputs[2].props.onChangeText(confirm); });
}

function pressSubmitButton(tree: ReactTestRenderer) {
  const buttons = tree.root.findAllByType(TouchableOpacity);
  const submitButton = buttons.find(
    (b) => b.props.children?.props?.children === 'changePassword.updatePassword'
       || b.props.children?.props?.children === 'changePassword.updating',
  ) || buttons[buttons.length - 1];
  act(() => { submitButton.props.onPress(); });
}

describe('ChangePasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  describe('SEC-2: password re-authentication bypass', () => {
    it('blocks password update when signInWithPassword returns null session', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      });

      const tree = renderScreen();
      fillPasswordFields(tree, 'oldpass', 'newpass123', 'newpass123');
      await act(async () => { pressSubmitButton(tree); });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'oldpass',
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'common.error',
        'changePassword.currentPasswordWrong',
      );
    });

    it('proceeds to updateUser when signInWithPassword returns valid session', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'tok' }, user: { id: '1' } },
        error: null,
      });
      mockUpdateUser.mockResolvedValue({ data: {}, error: null });
      mockSignOut.mockResolvedValue({ error: null });

      const tree = renderScreen();
      fillPasswordFields(tree, 'oldpass', 'newpass123', 'newpass123');
      await act(async () => { pressSubmitButton(tree); });

      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass123' });
    });

    it('blocks password update when signInWithPassword returns an error', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid credentials' },
      });

      const tree = renderScreen();
      fillPasswordFields(tree, 'wrongpass', 'newpass123', 'newpass123');
      await act(async () => { pressSubmitButton(tree); });

      expect(mockUpdateUser).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith(
        'common.error',
        'changePassword.currentPasswordWrong',
      );
    });
  });

  describe('SEC-4: session invalidation after password change', () => {
    it('calls signOut with global scope after successful password update', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'tok' }, user: { id: '1' } },
        error: null,
      });
      mockUpdateUser.mockResolvedValue({ data: {}, error: null });
      mockSignOut.mockResolvedValue({ error: null });

      const tree = renderScreen();
      fillPasswordFields(tree, 'oldpass', 'newpass123', 'newpass123');
      await act(async () => { pressSubmitButton(tree); });

      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
    });

    it('resets navigation to Login screen after successful password change', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'tok' }, user: { id: '1' } },
        error: null,
      });
      mockUpdateUser.mockResolvedValue({ data: {}, error: null });
      mockSignOut.mockResolvedValue({ error: null });

      const tree = renderScreen();
      fillPasswordFields(tree, 'oldpass', 'newpass123', 'newpass123');
      await act(async () => { pressSubmitButton(tree); });

      // Alert.alert is called with an OK button that triggers navigation reset
      expect(Alert.alert).toHaveBeenCalledWith(
        'common.success',
        'changePassword.success',
        expect.arrayContaining([
          expect.objectContaining({ text: 'OK' }),
        ]),
      );

      // Simulate pressing OK on the alert
      const alertCall = (Alert.alert as jest.Mock).mock.calls.find(
        (call) => call[0] === 'common.success',
      );
      const okButton = alertCall[2][0];
      okButton.onPress();

      expect(mockNavigation.reset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    });

    it('does not call signOut when updateUser fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: { access_token: 'tok' }, user: { id: '1' } },
        error: null,
      });
      mockUpdateUser.mockResolvedValue({
        data: {},
        error: { message: 'Update failed' },
      });

      const tree = renderScreen();
      fillPasswordFields(tree, 'oldpass', 'newpass123', 'newpass123');
      await act(async () => { pressSubmitButton(tree); });

      expect(mockSignOut).not.toHaveBeenCalled();
      expect(Alert.alert).toHaveBeenCalledWith('common.error', 'Update failed');
    });
  });
});
