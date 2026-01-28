import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { RouteFilters } from '../types/database.types';
import TrimmedTextInput from './TrimmedTextInput';

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

  const handleReset = () => {
    onApply({});
  };

  const isMyRoutesEnabled = filters.creatorId === userId && !!userId;
  const hasActiveFilters = !!filters.creatorId || !!filters.grade || !!filters.search;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('filters.title')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.searchRow}>
              <TrimmedTextInput
                style={styles.searchInput}
                value={filters.search || ''}
                onChangeText={handleSearchChange}
                placeholder={t('filters.searchPlaceholder')}
                placeholderTextColor="#999"
                autoCorrect={false}
                accessibilityLabel={t('filters.searchPlaceholder')}
              />
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t('filters.grade')}</Text>
              <TrimmedTextInput
                style={styles.gradeInput}
                value={filters.grade || ''}
                onChangeText={handleGradeChange}
                placeholder={t('filters.gradePlaceholder')}
                placeholderTextColor="#999"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel={t('filters.grade')}
              />
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>{t('filters.myRoutes')}</Text>
              <Switch
                value={isMyRoutesEnabled}
                onValueChange={handleMyRoutesToggle}
                trackColor={{ false: '#ddd', true: '#0066cc' }}
                accessibilityLabel={t('filters.toggleMyRoutes')}
              />
            </View>
          </View>

          <View style={styles.footer}>
            {hasActiveFilters && (
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>{t('filters.resetFilters')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: 200,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 16,
    color: '#0066cc',
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  searchRow: {
    paddingVertical: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
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
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    width: 120,
    textAlign: 'right',
  },
  footer: {
    padding: 16,
    paddingTop: 0,
  },
  resetButton: {
    padding: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    color: '#dc3545',
  },
});
