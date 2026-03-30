import React, { ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../lib/theme-context';

interface ListItemWithRouteProps {
  title: string;
  titleStyle?: StyleProp<TextStyle>;
  titleRight?: ReactNode;
  header?: ReactNode;
  headerStyle?: StyleProp<ViewStyle>;
  subtitle?: string;
  metadata?: ReactNode;
  onPress?: () => void;
  chevronPosition?: 'absolute' | 'inline';
}

export default function ListItemWithRoute({
  title,
  titleStyle,
  titleRight,
  header,
  headerStyle,
  subtitle,
  metadata,
  onPress,
  chevronPosition = 'absolute',
}: ListItemWithRouteProps) {
  const colors = useThemeColors();

  const inlineChevron = onPress && chevronPosition === 'inline';

  const body = (
    <View style={inlineChevron ? styles.inlineContent : undefined}>
      <View style={inlineChevron ? styles.flex1 : undefined}>
        {header ?? (
          <View style={[styles.header, headerStyle]}>
            <Text style={[styles.title, { color: colors.textPrimary }, titleStyle]}>
              {title}
            </Text>
            {titleRight}
          </View>
        )}
        {subtitle != null && (
          <Text
            style={[styles.subtitle, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
        {metadata}
      </View>
      {inlineChevron && (
        <Ionicons name="chevron-forward" size={20} color={colors.chevron} />
      )}
    </View>
  );

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.cardBackground, borderBottomColor: colors.separator },
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress}>
        {body}
        {chevronPosition === 'absolute' && (
          <View style={styles.chevron}>
            <Ionicons name="chevron-forward" size={20} color={colors.chevron} />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{body}</View>;
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
  },
  inlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
    paddingRight: 24,
  },
  chevron: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
});
