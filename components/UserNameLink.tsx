import React from 'react';
import { Text, TouchableOpacity, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../lib/theme-context';

interface UserNameLinkProps {
  userId: string;
  displayName?: string | null;
  style?: StyleProp<TextStyle>;
}

export default function UserNameLink({ userId, displayName, style }: UserNameLinkProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const navigation = useNavigation<any>();

  const handlePress = () => {
    navigation.navigate('UserProfile', { userId });
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Text style={[styles.name, { color: colors.primary }, style]}>
        {displayName || t('common.anonymous')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
});
