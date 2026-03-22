import React from 'react';
import {
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { baseStyles } from './FullScreenImageBase';
import { useThemeColors } from '../lib/theme-context';

interface HoldEditModalProps {
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelConfirmDelete: () => void;
  isDeleting: boolean;
  routesUsingHold: string[];
  inFocusedMode: boolean;
  onMoveHold: () => void;
  onRedrawShape: () => void;
}

export default function HoldEditModal({
  visible,
  onClose,
  onDelete,
  confirmingDelete,
  onConfirmDelete,
  onCancelConfirmDelete,
  isDeleting,
  routesUsingHold,
  inFocusedMode,
  onMoveHold,
  onRedrawShape,
}: HoldEditModalProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={baseStyles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={[baseStyles.modalContent, { backgroundColor: colors.cardBackground }]}>
          {confirmingDelete ? (
            <>
              <Text style={[baseStyles.modalTitle, { color: colors.textPrimary }]}>{t('editor.deleteHold')}</Text>
              <Text style={[styles.confirmText, { color: colors.textSecondary }]}>{t('editor.deleteHoldConfirm')}</Text>
              <TouchableOpacity
                style={[baseStyles.modalButton, baseStyles.modalButtonDanger]}
                onPress={onConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={baseStyles.modalButtonText}>{t('common.delete')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
                onPress={onCancelConfirmDelete}
              >
                <Text style={baseStyles.modalButtonText}>{t('editor.cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[baseStyles.modalTitle, { color: colors.textPrimary }]}>{t('editor.editHold')}</Text>

              {routesUsingHold.length > 0 && (
                <>
                  <Text style={[styles.warningText, { color: colors.danger }]}>
                    {t('editor.cannotDelete', { count: routesUsingHold.length })}
                  </Text>
                  {routesUsingHold.map((title, i) => (
                    <Text key={i} style={[styles.routeListItem, { color: colors.textSecondary }]}>• {title}</Text>
                  ))}
                </>
              )}

              {/* Move and Redraw only available in focused mode */}
              {inFocusedMode ? (
                <>
                  <TouchableOpacity
                    style={baseStyles.modalButton}
                    onPress={onMoveHold}
                  >
                    <Text style={baseStyles.modalButtonText}>{t('editor.moveHold')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={baseStyles.modalButton}
                    onPress={onRedrawShape}
                  >
                    <Text style={baseStyles.modalButtonText}>{t('editor.redrawShape')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={[styles.hintText, { color: colors.textTertiary }]}>
                  {t('editor.usePrecisionHint')}
                </Text>
              )}

              <TouchableOpacity
                style={[baseStyles.modalButton, baseStyles.modalButtonDanger]}
                onPress={onDelete}
                disabled={isDeleting || routesUsingHold.length > 0}
              >
                <Text style={baseStyles.modalButtonText}>{t('editor.deleteHold')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
                onPress={onClose}
              >
                <Text style={baseStyles.modalButtonText}>{t('editor.cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  confirmText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    marginBottom: 8,
  },
  routeListItem: {
    fontSize: 14,
    marginLeft: 8,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
});
