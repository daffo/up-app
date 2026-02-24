import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@app_theme';

export type ThemePreference = 'light' | 'dark' | 'system';

export type ThemeColors = {
  screenBackground: string;
  cardBackground: string;
  inputBackground: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnPrimary: string;
  border: string;
  borderLight: string;
  separator: string;
  primary: string;
  primaryLight: string;
  primaryLightAlt: string;
  danger: string;
  star: string;
  cancelButton: string;
  disabledButton: string;
  placeholderText: string;
  chevron: string;
  shadowColor: string;
};

const lightColors: ThemeColors = {
  screenBackground: '#f5f5f5',
  cardBackground: '#ffffff',
  inputBackground: '#ffffff',
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textOnPrimary: '#ffffff',
  border: '#dddddd',
  borderLight: '#eeeeee',
  separator: '#f0f0f0',
  primary: '#0066cc',
  primaryLight: '#e3f2fd',
  primaryLightAlt: '#f0f7ff',
  danger: '#dc3545',
  star: '#f5a623',
  cancelButton: '#6c757d',
  disabledButton: '#cccccc',
  placeholderText: '#999999',
  chevron: '#cccccc',
  shadowColor: '#000000',
};

const darkColors: ThemeColors = {
  screenBackground: '#121212',
  cardBackground: '#1e1e1e',
  inputBackground: '#2a2a2a',
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0a0',
  textTertiary: '#707070',
  textOnPrimary: '#ffffff',
  border: '#333333',
  borderLight: '#2a2a2a',
  separator: '#2a2a2a',
  primary: '#4d9fff',
  primaryLight: '#1a3a5c',
  primaryLightAlt: '#162d47',
  danger: '#ff6b7a',
  star: '#f5a623',
  cancelButton: '#8a8a8a',
  disabledButton: '#444444',
  placeholderText: '#666666',
  chevron: '#555555',
  shadowColor: '#000000',
};

type ThemeContextType = {
  themePreference: ThemePreference;
  isDark: boolean;
  colors: ThemeColors;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

let initialThemePreference: ThemePreference = 'system';

export const initTheme = async (): Promise<ThemePreference> => {
  try {
    const saved = await AsyncStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      initialThemePreference = saved;
      return saved;
    }
  } catch (error) {
    console.error('Error reading saved theme:', error);
  }
  return 'system';
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(initialThemePreference);

  const setThemePreference = useCallback(async (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    try {
      await AsyncStorage.setItem(THEME_KEY, pref);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }, []);

  const isDark = themePreference === 'system'
    ? systemColorScheme === 'dark'
    : themePreference === 'dark';

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ themePreference, isDark, colors, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}
