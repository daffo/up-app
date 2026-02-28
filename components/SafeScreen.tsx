import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { useThemeColors } from '../lib/theme-context';

interface SafeScreenProps extends SafeAreaViewProps {
  hasHeader?: boolean;
}

export default function SafeScreen({ hasHeader = true, style, children, ...props }: SafeScreenProps) {
  const colors = useThemeColors();
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.screenBackground }, style]}
      edges={hasHeader ? ['bottom'] : undefined}
      {...props}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
