import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth-context';

interface ProfileDropdownProps {
  onMyAccount: () => void;
  onMySends: () => void;
  onMyComments: () => void;
  onAdmin?: () => void;
  onLogout: () => void;
}

export default function ProfileDropdown({
  onMyAccount,
  onMySends,
  onMyComments,
  onAdmin,
  onLogout,
}: ProfileDropdownProps) {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [visible, setVisible] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<View>(null);

  const handleOpen = () => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      setDropdownPosition({
        top: y + height + 4,
        right: screenWidth - x - width,
      });
      setVisible(true);
    });
  };

  const handleClose = () => {
    setVisible(false);
  };

  const handleMyAccount = () => {
    handleClose();
    onMyAccount();
  };

  const handleMySends = () => {
    handleClose();
    onMySends();
  };

  const handleMyComments = () => {
    handleClose();
    onMyComments();
  };

  const handleAdmin = () => {
    handleClose();
    onAdmin?.();
  };

  const handleLogout = () => {
    handleClose();
    onLogout();
  };

  // Get initials from email
  const getInitials = () => {
    if (!user?.email) return '?';
    const parts = user.email.split('@')[0].split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  return (
    <>
      <TouchableOpacity onPress={handleOpen}>
        <View ref={buttonRef} style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials()}</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <View
            style={[
              styles.dropdown,
              { top: dropdownPosition.top, right: dropdownPosition.right },
            ]}
          >
            <TouchableOpacity style={styles.menuItem} onPress={handleMyAccount}>
              <Text style={styles.menuItemText}>{t('menu.myAccount')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleMySends}>
              <Text style={styles.menuItemText}>{t('menu.mySends')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleMyComments}>
              <Text style={styles.menuItemText}>{t('menu.myComments')}</Text>
            </TouchableOpacity>

            {isAdmin && onAdmin && (
              <TouchableOpacity style={styles.menuItem} onPress={handleAdmin}>
                <Text style={styles.menuItemText}>{t('menu.admin')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.separator} />

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Text style={[styles.menuItemText, styles.logoutText]}>{t('menu.logout')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 4,
  },
  logoutText: {
    color: '#dc3545',
  },
});
