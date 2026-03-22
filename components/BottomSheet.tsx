import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useThemeColors } from '../lib/theme-context';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Text for the header close/dismiss button. */
  closeLabel: string;
  /** Color override for close button text. Defaults to colors.primary. */
  closeLabelColor?: string;
  children: React.ReactNode;
  /** Optional footer content rendered below the main content. */
  footer?: React.ReactNode;
  /** Optional style override for the sheet container. */
  sheetStyle?: ViewStyle;
}

export default function BottomSheet({
  visible,
  onClose,
  title,
  closeLabel,
  closeLabelColor,
  children,
  footer,
  sheetStyle,
}: BottomSheetProps) {
  const colors = useThemeColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel={closeLabel}
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { backgroundColor: colors.cardBackground }, sheetStyle]}>
          <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.closeButton, { color: closeLabelColor ?? colors.primary }]}>
                {closeLabel}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.content}>{children}</View>
          {footer && <View style={styles.footer}>{footer}</View>}
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
