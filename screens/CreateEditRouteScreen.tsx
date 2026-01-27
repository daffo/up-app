import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import TrimmedTextInput from '../components/TrimmedTextInput';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../lib/auth-context';
import { Database, Hold, DetectedHold } from '../types/database.types';
import { routesApi, photosApi, detectedHoldsApi } from '../lib/api';
import FullScreenRouteEditor from '../components/FullScreenRouteEditor';
import RouteOverlay from '../components/RouteOverlay';
import { formatDate } from '../utils/date';

type Photo = Database['public']['Tables']['photos']['Row'];
type Route = Database['public']['Tables']['routes']['Row'];

interface CreateEditRouteScreenProps {
  navigation: any;
  route: any;
}

export default function CreateEditRouteScreen({ navigation, route }: CreateEditRouteScreenProps) {
  const { user } = useAuth();
  const { routeId } = route.params || {};
  const isEditMode = !!routeId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [grade, setGrade] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [holds, setHolds] = useState<Hold[]>([]);

  // Data
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [detectedHolds, setDetectedHolds] = useState<DetectedHold[]>([]);
  const [existingRoute, setExistingRoute] = useState<Route | null>(null);

  // Image dimensions for scaling
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);
  const [displayWidth, setDisplayWidth] = useState(0);
  const [displayHeight, setDisplayHeight] = useState(0);

  // Fullscreen editor state
  const [editorVisible, setEditorVisible] = useState(false);

  useEffect(() => {
    initialize();
  }, [routeId]);

  const initialize = async () => {
    try {
      setLoading(true);

      // Fetch available photos (only active ones)
      const photosData = await photosApi.listActive();
      setPhotos(photosData);

      // If editing, fetch existing route
      if (isEditMode) {
        const routeData = await routesApi.get(routeId);

        // Check if user owns this route
        if (routeData.user_id !== user?.id) {
          Alert.alert('Error', 'You can only edit your own routes');
          navigation.goBack();
          return;
        }

        setExistingRoute(routeData);
        setTitle(routeData.title);
        setDescription(routeData.description || '');
        setGrade(routeData.grade);
        setSelectedPhotoId(routeData.photo_id);
        setHolds(routeData.holds);
      } else {
        // Default to first photo for new routes
        if (photosData && photosData.length > 0) {
          setSelectedPhotoId(photosData[0].id);
        }
      }
    } catch (err) {
      console.error('Error initializing:', err);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const selectedPhoto = photos.find(p => p.id === selectedPhotoId);

  useEffect(() => {
    if (selectedPhoto) {
      // Get actual image dimensions
      Image.getSize(
        selectedPhoto.image_url,
        (width, height) => {
          setImageWidth(width);
          setImageHeight(height);

          // Calculate display dimensions
          const screenWidth = Dimensions.get('window').width - 40; // minus padding
          const aspectRatio = height / width;
          const calculatedHeight = screenWidth * aspectRatio;

          setDisplayWidth(screenWidth);
          setDisplayHeight(calculatedHeight);
        },
        (error) => {
          console.error('Failed to get image size:', error);
        }
      );
    }
  }, [selectedPhoto]);

  // Fetch detected holds when photo changes
  useEffect(() => {
    const fetchDetectedHolds = async () => {
      if (!selectedPhotoId) {
        setDetectedHolds([]);
        return;
      }

      try {
        const data = await detectedHoldsApi.listByPhoto(selectedPhotoId);
        setDetectedHolds(data);
      } catch (err) {
        console.error('Error fetching detected holds:', err);
        setDetectedHolds([]);
      }
    };

    fetchDetectedHolds();
  }, [selectedPhotoId]);

  const handleUpdateHolds = (updatedHolds: Hold[]) => {
    setHolds(updatedHolds);
  };

  const handleReorderHolds = (reorderedHolds: Hold[]) => {
    // Update order property based on new position
    const holdsWithUpdatedOrder = reorderedHolds.map((hold, index) => ({
      ...hold,
      order: index + 1,
    }));
    setHolds(holdsWithUpdatedOrder);
  };

  const deleteHold = (holdToDelete: Hold) => {
    const newHolds = holds.filter(h => h !== holdToDelete);
    handleReorderHolds(newHolds);
  };

  const renderHoldItem = useCallback(({ item, drag, isActive }: RenderItemParams<Hold>) => (
    <ScaleDecorator>
      <TouchableOpacity
        onLongPress={drag}
        disabled={isActive}
        style={[styles.holdItem, isActive && styles.holdItemActive]}
      >
        <Text style={styles.holdItemText}>
          {item.order}. {item.note || '(no note)'}
        </Text>
        <View style={styles.holdItemButtons}>
          <Text style={styles.dragHandle}>☰</Text>
          <TouchableOpacity
            onPress={() => deleteHold(item)}
            style={[styles.holdActionButton, styles.holdDeleteButton]}
          >
            <Text style={styles.holdActionButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </ScaleDecorator>
  ), [holds]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save a route');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!grade.trim()) {
      Alert.alert('Error', 'Please enter a grade');
      return;
    }

    if (!selectedPhotoId) {
      Alert.alert('Error', 'Please select a photo');
      return;
    }

    if (holds.length === 0) {
      Alert.alert('Error', 'Please add at least one hold');
      return;
    }

    try {
      setSaving(true);

      if (isEditMode) {
        // Update existing route (automatically invalidates cache)
        await routesApi.update(routeId, {
          title: title.trim(),
          description: description.trim() || null,
          grade: grade.trim(),
          photo_id: selectedPhotoId,
          holds,
        });

        Alert.alert('Success', 'Route updated successfully');
        navigation.goBack();
      } else {
        // Create new route (automatically invalidates cache)
        const data = await routesApi.create({
          title: title.trim(),
          description: description.trim() || null,
          grade: grade.trim(),
          photo_id: selectedPhotoId,
          holds,
          user_id: user.id,
        });

        Alert.alert('Success', 'Route created successfully');
        navigation.replace('RouteDetail', { routeId: data.id });
      }
    } catch (err) {
      console.error('Error saving route:', err);
      Alert.alert('Error', 'Failed to save route');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Route',
      `Are you sure you want to delete "${title || 'this route'}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await routesApi.delete(routeId);
              Alert.alert('Deleted', 'Route has been deleted');
              navigation.goBack();
            } catch (err) {
              console.error('Error deleting route:', err);
              Alert.alert('Error', 'Failed to delete route');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.form}>
        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TrimmedTextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Crimpy Traverse"
          />
        </View>

        {/* Grade */}
        <View style={styles.field}>
          <Text style={styles.label}>Grade *</Text>
          <TrimmedTextInput
            style={styles.input}
            value={grade}
            onChangeText={setGrade}
            placeholder="e.g., V4, 6b+"
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TrimmedTextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional route description"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Photo Selection */}
        <View style={styles.field}>
          <Text style={styles.label}>Spray Wall Photo *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoSelector}>
            {photos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={[
                  styles.photoOption,
                  selectedPhotoId === photo.id && styles.photoOptionSelected,
                ]}
                onPress={() => setSelectedPhotoId(photo.id)}
              >
                <Image source={{ uri: photo.image_url }} style={styles.photoThumbnail} />
                <Text style={styles.photoDate}>
                  {formatDate(photo.setup_date)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Hold Placement */}
        {selectedPhoto && displayWidth > 0 && (
          <View style={styles.field}>
            <Text style={styles.label}>Route Preview ({holds.length} holds)</Text>
            <Text style={styles.helperText}>Tap to edit holds in fullscreen</Text>
            <TouchableOpacity
              style={styles.imageContainer}
              onPress={() => setEditorVisible(true)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: selectedPhoto.image_url }}
                style={{ width: displayWidth, height: displayHeight }}
              />
              <RouteOverlay
                holds={holds}
                detectedHolds={detectedHolds}
                width={displayWidth}
                height={displayHeight}
                pointerEvents="none"
              />
              </TouchableOpacity>

            {/* Hold List - Drag to reorder */}
            {holds.length > 0 && (
              <View style={styles.holdsList}>
                <Text style={styles.holdsListTitle}>Holds (long press to drag):</Text>
                <GestureHandlerRootView>
                  <DraggableFlatList
                    data={holds}
                    onDragEnd={({ data }) => handleReorderHolds(data)}
                    keyExtractor={(item) => `hold-${item.order}-${item.detected_hold_id}`}
                    renderItem={renderHoldItem}
                    scrollEnabled={false}
                  />
                </GestureHandlerRootView>
              </View>
            )}
          </View>
        )}
        </View>
      </ScrollView>

      {/* Sticky Footer Buttons */}
      <View style={styles.stickyFooter}>
        <View style={styles.footerButtons}>
          {isEditMode && (
            <TouchableOpacity
              style={[styles.footerButton, styles.deleteButton]}
              onPress={handleDelete}
              disabled={saving}
            >
              <Text style={styles.footerButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.footerButton, styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.footerButtonText}>
                {isEditMode ? 'Save Changes' : 'Create Route'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Fullscreen Hold Editor */}
      {selectedPhoto && (
        <FullScreenRouteEditor
          visible={editorVisible}
          photoUrl={selectedPhoto.image_url}
          holds={holds}
          detectedHolds={detectedHolds}
          onClose={() => setEditorVisible(false)}
          onUpdateHolds={handleUpdateHolds}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  form: {
    padding: 20,
  },
  stickyFooter: {
    padding: 20,
    paddingTop: 12,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  photoSelector: {
    flexDirection: 'row',
  },
  photoOption: {
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoOptionSelected: {
    borderColor: '#0066cc',
    borderWidth: 3,
  },
  photoThumbnail: {
    width: 100,
    height: 100,
  },
  photoDate: {
    fontSize: 10,
    textAlign: 'center',
    padding: 4,
    backgroundColor: '#fff',
  },
  imageContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  holdsList: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  holdsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  holdItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 10,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  holdItemText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  holdItemActive: {
    backgroundColor: '#e3f2fd',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  holdItemButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dragHandle: {
    fontSize: 18,
    color: '#999',
  },
  holdActionButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  holdDeleteButton: {
    backgroundColor: '#dc3545',
  },
  holdActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  footerButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#0066cc',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
