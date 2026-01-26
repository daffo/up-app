import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { RouteFilters } from '../types/database.types';

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
  const [localFilters, setLocalFilters] = React.useState<RouteFilters>(filters);

  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters, visible]);

  const handleMyRoutesToggle = (value: boolean) => {
    if (value && !userId) {
      onClose();
      onLoginRequired();
      return;
    }
    setLocalFilters({
      ...localFilters,
      creatorId: value ? userId : undefined,
    });
  };

  const handleApply = () => {
    onApply(localFilters);
    onClose();
  };

  const handleReset = () => {
    const emptyFilters: RouteFilters = {};
    setLocalFilters(emptyFilters);
    onApply(emptyFilters);
    onClose();
  };

  const isMyRoutesEnabled = localFilters.creatorId === userId && !!userId;
  const hasActiveFilters = !!localFilters.creatorId;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={handleApply} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity onPress={handleApply}>
              <Text style={styles.closeButton}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>My Routes</Text>
              <Switch
                value={isMyRoutesEnabled}
                onValueChange={handleMyRoutesToggle}
                trackColor={{ false: '#ddd', true: '#0066cc' }}
              />
            </View>
          </View>

          <View style={styles.footer}>
            {hasActiveFilters && (
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Reset Filters</Text>
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
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  filterLabel: {
    fontSize: 16,
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
