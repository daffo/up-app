import { useState } from 'react';
import {
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Hold, DetectedHold } from '../types/database.types';
import { supabase } from '../lib/supabase';
import FullScreenImageBase, { baseStyles } from './FullScreenImageBase';

interface FullScreenHoldEditorProps {
  visible: boolean;
  photoUrl: string;
  holds: Hold[];
  detectedHolds: DetectedHold[];
  onClose: () => void;
  photoId: string;
  onDeleteDetectedHold?: (holdId: string) => void;
}

export default function FullScreenHoldEditor({
  visible,
  photoUrl,
  holds,
  detectedHolds,
  onClose,
  photoId,
  onDeleteDetectedHold,
}: FullScreenHoldEditorProps) {
  const [selectedHoldIndex, setSelectedHoldIndex] = useState<number | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [routesUsingHold, setRoutesUsingHold] = useState<string[]>([]);

  const handleHoldPress = (index: number) => {
    setSelectedHoldIndex(index);
    setDeleteModalVisible(true);
  };

  const handleDeleteHold = async () => {
    if (selectedHoldIndex === null) return;

    const selectedHold = detectedHolds[selectedHoldIndex];
    setIsDeleting(true);

    // Check if this hold is used in any route
    const { data: routes } = await supabase
      .from('routes')
      .select('id, title, holds')
      .eq('photo_id', photoId);

    const usingRoutes: string[] = [];
    if (routes) {
      for (const route of routes) {
        const routeHolds = route.holds as Hold[];
        if (routeHolds.some(h => h.detected_hold_id === selectedHold.id)) {
          usingRoutes.push(route.title);
        }
      }
    }

    // If hold is used in routes, show error and abort
    if (usingRoutes.length > 0) {
      setIsDeleting(false);
      setRoutesUsingHold(usingRoutes);
      return;
    }

    // Delete the hold
    const { error } = await supabase
      .from('detected_holds')
      .delete()
      .eq('id', selectedHold.id);

    setIsDeleting(false);

    if (error) {
      Alert.alert('Error', 'Failed to delete hold: ' + error.message);
      return;
    }

    // Notify parent to update state
    if (onDeleteDetectedHold) {
      onDeleteDetectedHold(selectedHold.id);
    }

    closeModal();
  };

  const closeModal = () => {
    setDeleteModalVisible(false);
    setSelectedHoldIndex(null);
    setRoutesUsingHold([]);
  };

  return (
    <FullScreenImageBase
      visible={visible}
      photoUrl={photoUrl}
      holds={holds}
      detectedHolds={detectedHolds}
      onClose={onClose}
      showLabels={false}
      closeButtonText="✕"
      overlayPointerEvents="auto"
      onHoldPress={handleHoldPress}
    >
      {/* Delete Hold Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={baseStyles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <TouchableOpacity activeOpacity={1} style={baseStyles.modalContent}>
            <Text style={baseStyles.modalTitle}>
              Hold #{selectedHoldIndex !== null ? selectedHoldIndex + 1 : ''}
            </Text>

            {routesUsingHold.length > 0 && (
              <>
                <Text style={styles.warningText}>
                  Cannot delete - used in {routesUsingHold.length} route(s):
                </Text>
                {routesUsingHold.map((title, i) => (
                  <Text key={i} style={styles.routeListItem}>• {title}</Text>
                ))}
              </>
            )}

            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonDanger]}
              onPress={handleDeleteHold}
              disabled={isDeleting || routesUsingHold.length > 0}
            >
              {isDeleting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={baseStyles.modalButtonText}>Delete Hold</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[baseStyles.modalButton, baseStyles.modalButtonCancel]}
              onPress={closeModal}
            >
              <Text style={baseStyles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </FullScreenImageBase>
  );
}

const styles = StyleSheet.create({
  warningText: {
    fontSize: 14,
    color: '#dc3545',
    marginBottom: 8,
  },
  routeListItem: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    marginBottom: 4,
  },
});
