import React, { useState } from 'react';
import { Text, TouchableOpacity, View, StyleSheet, StyleProp, TextStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { AppNavigationProp } from '../navigation/types';
import { useThemeColors } from '../lib/theme-context';
import { BADGE_PRESENTATION } from '../lib/badges';
import { BadgeKey } from '../types/database.types';
import BadgeGlyph from './BadgeGlyph';
import BottomSheet from './BottomSheet';

interface UserNameLinkProps {
  userId: string;
  displayName?: string | null;
  showcaseBadgeKey?: BadgeKey | null;
  style?: StyleProp<TextStyle>;
}

export default function UserNameLink({ userId, displayName, showcaseBadgeKey, style }: UserNameLinkProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const navigation = useNavigation<AppNavigationProp>();
  const [sheetVisible, setSheetVisible] = useState(false);

  const handlePress = () => {
    navigation.navigate('UserProfile', { userId });
  };

  const pres = showcaseBadgeKey ? BADGE_PRESENTATION[showcaseBadgeKey] : null;

  return (
    <View style={styles.row}>
      {pres && showcaseBadgeKey && (
        <TouchableOpacity
          onPress={() => setSheetVisible(true)}
          accessibilityLabel={t(`badges.${showcaseBadgeKey}.name`)}
          style={styles.badgeWrapper}
        >
          <BadgeGlyph iconSet={pres.iconSet} icon={pres.icon} color={pres.color} size={16} />
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={handlePress}>
        <Text style={[styles.name, { color: colors.primary }, style]}>
          {displayName || t('common.anonymous')}
        </Text>
      </TouchableOpacity>

      {pres && showcaseBadgeKey && (
        <BottomSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          title={t(`badges.${showcaseBadgeKey}.name`)}
          closeLabel={t('common.done')}
        >
          <View style={styles.sheetIcon}>
            <BadgeGlyph iconSet={pres.iconSet} icon={pres.icon} color={pres.color} size={64} />
          </View>
          <Text style={[styles.sheetDesc, { color: colors.textSecondary }]}>
            {t(`badges.${showcaseBadgeKey}.desc`)}
          </Text>
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeWrapper: {
    marginRight: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  sheetIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetDesc: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
});
