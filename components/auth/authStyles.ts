import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeColors, ThemeColors } from '../../lib/theme-context';

export function useAuthStyles() {
  const colors = useThemeColors();
  return useMemo(() => createAuthStyles(colors), [colors]);
}

function createAuthStyles(colors: ThemeColors) {
  return {
    styles: StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: colors.screenBackground,
      },
      content: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
      },
      title: {
        fontSize: 48,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
        color: colors.textPrimary,
      },
      subtitle: {
        fontSize: 18,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 40,
      },
      form: {
        gap: 16,
      },
      input: {
        backgroundColor: colors.inputBackground,
        padding: 16,
        borderRadius: 8,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
      },
      button: {
        backgroundColor: colors.primary,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center' as const,
        marginTop: 8,
      },
      buttonDisabled: {
        opacity: 0.6,
      },
      buttonText: {
        color: colors.textOnPrimary,
        fontSize: 16,
        fontWeight: '600',
      },
      linkButton: {
        padding: 8,
        alignItems: 'center' as const,
        marginTop: 8,
      },
      linkText: {
        color: colors.primary,
        fontSize: 14,
      },
      divider: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginVertical: 20,
      },
      dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
      },
      dividerText: {
        marginHorizontal: 10,
        color: colors.textTertiary,
        fontSize: 14,
        fontWeight: '500',
      },
      googleButton: {
        backgroundColor: colors.cardBackground,
        padding: 16,
        borderRadius: 8,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
      },
      googleButtonText: {
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: '600',
      },
    }),
    colors,
  };
}
