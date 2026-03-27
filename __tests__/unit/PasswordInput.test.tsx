import React from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { TextInput, TouchableOpacity } from 'react-native';

// Mock dependencies before importing component
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../lib/theme-context', () => ({
  useThemeColors: () => ({
    inputBackground: '#fff',
    border: '#ccc',
    textPrimary: '#000',
    textTertiary: '#999',
    placeholderText: '#aaa',
  }),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('../../components/auth/authStyles', () => ({
  useAuthStyles: () => ({
    styles: {
      passwordContainer: {},
      passwordInput: {},
      eyeButton: {},
    },
    colors: {
      textTertiary: '#999',
      placeholderText: '#aaa',
    },
  }),
}));

import PasswordInput from '../../components/auth/PasswordInput';

describe('PasswordInput', () => {
  it('renders with secureTextEntry enabled by default', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <PasswordInput
          placeholder="Password"
          value=""
          onChangeText={() => {}}
        />,
      );
    });

    const input = tree!.root.findByType(TextInput);
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('toggles password visibility when eye icon is pressed', () => {
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <PasswordInput
          placeholder="Password"
          value="secret"
          onChangeText={() => {}}
        />,
      );
    });

    // Initially hidden
    let input = tree!.root.findByType(TextInput);
    expect(input.props.secureTextEntry).toBe(true);

    // Find eye button and tap it
    const eyeButton = tree!.root.findByType(TouchableOpacity);
    expect(eyeButton.props.accessibilityLabel).toBe('auth.showPassword');

    act(() => {
      eyeButton.props.onPress();
    });

    // Now visible
    input = tree!.root.findByType(TextInput);
    expect(input.props.secureTextEntry).toBe(false);
    expect(eyeButton.props.accessibilityLabel).toBe('auth.hidePassword');

    // Toggle back
    act(() => {
      eyeButton.props.onPress();
    });

    input = tree!.root.findByType(TextInput);
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('passes through TextInput props', () => {
    const onChangeText = jest.fn();
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <PasswordInput
          placeholder="Enter password"
          value="test123"
          onChangeText={onChangeText}
          editable={false}
          accessibilityLabel="My password"
        />,
      );
    });

    const input = tree!.root.findByType(TextInput);
    expect(input.props.placeholder).toBe('Enter password');
    expect(input.props.value).toBe('test123');
    expect(input.props.editable).toBe(false);
    expect(input.props.accessibilityLabel).toBe('My password');
  });

  it('calls onChangeText when input changes', () => {
    const onChangeText = jest.fn();
    let tree: ReactTestRenderer;
    act(() => {
      tree = create(
        <PasswordInput
          placeholder="Password"
          value=""
          onChangeText={onChangeText}
        />,
      );
    });

    const input = tree!.root.findByType(TextInput);
    act(() => {
      input.props.onChangeText('newpassword');
    });

    expect(onChangeText).toHaveBeenCalledWith('newpassword');
  });
});
