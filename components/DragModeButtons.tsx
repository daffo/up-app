import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface DragModeButtonsProps {
  onCancel: () => void;
  onSave: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
}

/**
 * Cancel/Save button pair for drag mode operations.
 * Used in move hold, move label, and similar drag-based editors.
 */
export default function DragModeButtons({
  onCancel,
  onSave,
  isSaving = false,
  saveDisabled = false,
}: DragModeButtonsProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, styles.cancelButton]}
        onPress={onCancel}
        disabled={isSaving}
      >
        <Text style={styles.buttonText}>{t('common.cancel')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.saveButton]}
        onPress={onSave}
        disabled={isSaving || saveDisabled}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>{t('common.save')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(108, 117, 125, 0.95)',
  },
  saveButton: {
    backgroundColor: 'rgba(0, 102, 204, 0.95)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
