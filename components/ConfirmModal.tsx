import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../lib/theme-context';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Style the confirm button as destructive (red). */
  destructive?: boolean;
}

interface ConfirmModalProps extends ConfirmOptions {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Hide the cancel button — single-button acknowledgement ("notify") mode. */
  hideCancel?: boolean;
}

/**
 * Themed, cross-platform confirmation dialog. Renders identically on web and
 * native (unlike `Alert.alert`, whose button array is a no-op on RN Web).
 * Driven by the ConfirmProvider / useConfirm hook — not meant to be rendered
 * directly by screens.
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  destructive = false,
  onConfirm,
  onCancel,
  hideCancel = false,
}: ConfirmModalProps) {
  const colors = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.content, { backgroundColor: colors.cardBackground }]}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          ) : null}

          <View style={styles.buttonRow}>
            {!hideCancel && (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.cancelButton }]}
                onPress={onCancel}
              >
                <Text style={[styles.buttonText, { color: colors.textPrimary }]}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: destructive ? colors.danger : colors.primary },
              ]}
              onPress={onConfirm}
            >
              <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    padding: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
