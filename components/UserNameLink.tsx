import React from 'react';
import { Text, TouchableOpacity, StyleSheet, TextStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

interface UserNameLinkProps {
  userId: string;
  displayName?: string | null;
  style?: TextStyle;
}

export default function UserNameLink({ userId, displayName, style }: UserNameLinkProps) {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const handlePress = () => {
    navigation.navigate('UserProfile', { userId });
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Text style={[styles.name, style]}>
        {displayName || t('common.anonymous')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0066cc',
  },
});
