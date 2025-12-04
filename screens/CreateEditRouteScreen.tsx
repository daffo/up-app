import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { Database, Hold } from '../types/database.types';
import FullScreenRouteViewer from '../components/FullScreenRouteViewer';
import RouteOverlay from '../components/RouteOverlay';

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

      // Fetch available photos (only active ones - no teardown date or teardown in future)
      const { data: photosData, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .or('teardown_date.is.null,teardown_date.gte.' + new Date().toISOString())
        .order('setup_date', { ascending: false });

      if (photosError) throw photosError;
      setPhotos(photosData || []);

      // If editing, fetch existing route
      if (isEditMode) {
        const { data: routeData, error: routeError } = await supabase
          .from('routes')
          .select('*')
          .eq('id', routeId)
          .single();

        if (routeError) throw routeError;

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

  const handleUpdateHolds = (updatedHolds: Hold[]) => {
    setHolds(updatedHolds);
  };

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
        // Update existing route
        const { error } = await supabase
          .from('routes')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            grade: grade.trim(),
            photo_id: selectedPhotoId,
            holds,
          })
          .eq('id', routeId);

        if (error) throw error;

        Alert.alert('Success', 'Route updated successfully');
        navigation.goBack();
      } else {
        // Create new route
        const { data, error } = await supabase
          .from('routes')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            grade: grade.trim(),
            photo_id: selectedPhotoId,
            holds,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;

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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Crimpy Traverse"
          />
        </View>

        {/* Grade */}
        <View style={styles.field}>
          <Text style={styles.label}>Grade *</Text>
          <TextInput
            style={styles.input}
            value={grade}
            onChangeText={setGrade}
            placeholder="e.g., V4, 6b+"
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
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
                  {new Date(photo.setup_date).toLocaleDateString()}
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
                width={displayWidth}
                height={displayHeight}
                pointerEvents="none"
              />
              </TouchableOpacity>

            {/* Hold List - Read only */}
            {holds.length > 0 && (
              <View style={styles.holdsList}>
                <Text style={styles.holdsListTitle}>Holds:</Text>
                {holds.map((hold) => (
                  <Text key={hold.order} style={styles.holdItemText}>
                    {hold.order}. {hold.note || '(no note)'}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditMode ? 'Update Route' : 'Create Route'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Fullscreen Hold Editor */}
      {selectedPhoto && (
        <FullScreenRouteViewer
          visible={editorVisible}
          photoUrl={selectedPhoto.image_url}
          holds={holds}
          onClose={() => setEditorVisible(false)}
          editable={true}
          onUpdateHolds={handleUpdateHolds}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  holdItemText: {
    fontSize: 14,
    color: '#333',
    paddingVertical: 4,
  },
  saveButton: {
    backgroundColor: '#0066cc',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
