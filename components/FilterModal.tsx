import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { RouteFilters } from '../types/database.types';
import { useThemeColors } from '../lib/theme-context';
import TrimmedTextInput from './TrimmedTextInput';
import BottomSheet from './BottomSheet';

interface FilterModalProps {
  visible: boolean;
  filters: RouteFilters;
  userId?: string;
  onClose: () => void;
  onApply: (filters: RouteFilters) => void;
  onLoginRequired: () => void;
}

export default function FilterModal({
  visible,
  filters,
  userId,
  onClose,
  onApply,
  onLoginRequired,
}: FilterModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const handleMyRoutesToggle = (value: boolean) => {
    if (value && !userId) {
      onClose();
      onLoginRequired();
      return;
    }
    onApply({ ...filters, creatorId: value ? userId : undefined });
  };

  const handleSearchChange = (text: string) => {
    onApply({ ...filters, search: text || undefined });
  };

  const handleGradeChange = (text: string) => {
    onApply({ ...filters, grade: text || undefined });
  };

  const handleWallStatusChange = (status: 'active' | 'past' | 'all') => {
    onApply({ ...filters, wallStatus: status });
  };

  const handleReset = () => {
    onApply({ wallStatus: 'active' });
  };

  const isMyRoutesEnabled = filters.creatorId === userId && !!userId;
  const wallStatus = filters.wallStatus ?? 'active';
  const hasActiveFilters = !!filters.creatorId || !!filters.grade || !!filters.search || (wallStatus !== 'active');

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('filters.title')}
      closeLabel={t('common.done')}
      sheetStyle={filterSheetStyle}
      footer={
        hasActiveFilters ? (
          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Text style={[styles.resetButtonText, { color: colors.danger }]}>{t('filters.resetFilters')}</Text>
          </TouchableOpacity>
        ) : undefined
      }
    >
      <View style={styles.searchRow}>
        <TrimmedTextInput
          style={[styles.searchInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
          value={filters.search || ''}
          onChangeText={handleSearchChange}
          placeholder={t('filters.searchPlaceholder')}
          placeholderTextColor={colors.placeholderText}
          autoCorrect={false}
          accessibilityLabel={t('filters.searchPlaceholder')}
        />
      </View>

      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: colors.textPrimary }]}>{t('filters.grade')}</Text>
        <TrimmedTextInput
          style={[styles.gradeInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
          value={filters.grade || ''}
          onChangeText={handleGradeChange}
          placeholder={t('filters.gradePlaceholder')}
          placeholderTextColor={colors.placeholderText}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t('filters.grade')}
        />
      </View>

      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: colors.textPrimary }]}>{t('filters.myRoutes')}</Text>
        <Switch
          value={isMyRoutesEnabled}
          onValueChange={handleMyRoutesToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          accessibilityLabel={t('filters.toggleMyRoutes')}
        />
      </View>

      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: colors.textPrimary }]}>{t('filters.wall')}</Text>
        <View style={[styles.segmentedControl, { borderColor: colors.border }]}>
          {(['active', 'past', 'all'] as const).map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.segmentButton,
                wallStatus === status && { backgroundColor: colors.primary },
              ]}
              onPress={() => handleWallStatusChange(status)}
              accessibilityLabel={t(`filters.wall${status.charAt(0).toUpperCase() + status.slice(1)}`)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: colors.textPrimary },
                  wallStatus === status && { color: '#fff' },
                ]}
              >
                {t(`filters.wall${status.charAt(0).toUpperCase() + status.slice(1)}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const filterSheetStyle = { minHeight: 200 } as const;

const styles = StyleSheet.create({
  searchRow: {
    paddingVertical: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  filterLabel: {
    fontSize: 16,
  },
  gradeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 120,
    textAlign: 'right',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segmentButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '500',
  },
  resetButton: {
    padding: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
  },
});
