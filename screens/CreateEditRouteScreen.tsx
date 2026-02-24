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
import { useTranslation } from 'react-i18next';
import TrimmedTextInput from '../components/TrimmedTextInput';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../lib/auth-context';
import { Database, Hold, DetectedHold } from '../types/database.types';
import { routesApi, photosApi, detectedHoldsApi } from '../lib/api';
import FullScreenRouteEditor from '../components/FullScreenRouteEditor';
import { getHoldLabel } from '../utils/holds';
import { useThemeColors } from '../lib/theme-context';
import RouteOverlay from '../components/RouteOverlay';
import { formatDate } from '../utils/date';

type Photo = Database['public']['Tables']['photos']['Row'];
type Route = Database['public']['Tables']['routes']['Row'];

interface CreateEditRouteScreenProps {
  navigation: any;
  route: any;
}

export default function CreateEditRouteScreen({ navigation, route }: CreateEditRouteScreenProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const colors = useThemeColors();
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
          Alert.alert(t('common.error'), t('routeForm.errorOwnership'));
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
      Alert.alert(t('common.error'), t('routeForm.errorLoad'));
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
        style={[
          styles.holdItem,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
          isActive && { backgroundColor: colors.primaryLight, shadowColor: colors.shadowColor },
        ]}
      >
        <Text style={[styles.holdItemText, { color: colors.textPrimary }]}>
          {getHoldLabel(item.order - 1, holds.length, item.note) || t('routeForm.noNote')}
        </Text>
        <View style={styles.holdItemButtons}>
          <Text style={[styles.dragHandle, { color: colors.textTertiary }]}>☰</Text>
          <TouchableOpacity
            onPress={() => deleteHold(item)}
            style={[styles.holdActionButton, { backgroundColor: colors.danger }]}
          >
            <Text style={styles.holdActionButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </ScaleDecorator>
  ), [holds, t, colors]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert(t('common.error'), t('routeForm.errorLogin'));
      return;
    }

    if (!title.trim()) {
      Alert.alert(t('common.error'), t('routeForm.errorTitle'));
      return;
    }

    if (!grade.trim()) {
      Alert.alert(t('common.error'), t('routeForm.errorGrade'));
      return;
    }

    if (!selectedPhotoId) {
      Alert.alert(t('common.error'), t('routeForm.errorPhoto'));
      return;
    }

    if (holds.length === 0) {
      Alert.alert(t('common.error'), t('routeForm.errorHolds'));
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

        Alert.alert(t('common.success'), t('routeForm.routeUpdated'));
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

        Alert.alert(t('common.success'), t('routeForm.routeCreated'));
        navigation.replace('RouteDetail', { routeId: data.id });
      }
    } catch (err) {
      console.error('Error saving route:', err);
      Alert.alert(t('common.error'), t('routeForm.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('routeForm.deleteRoute'),
      t('routeForm.deleteConfirm', { title: title || 'this route' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await routesApi.delete(routeId);
              Alert.alert(t('routeForm.deleted'), t('routeForm.routeDeleted'));
              navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
            } catch (err) {
              console.error('Error deleting route:', err);
              Alert.alert(t('common.error'), t('routeForm.errorDelete'));
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
      <View style={[styles.centerContainer, { backgroundColor: colors.screenBackground }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.screenBackground }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.form}>
        {/* Title */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('routeForm.title')} *</Text>
          <TrimmedTextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }]}
            value={title}
            onChangeText={setTitle}
            placeholder={t('routeForm.titlePlaceholder')}
            placeholderTextColor={colors.placeholderText}
            accessibilityLabel={t('routeForm.title')}
            maxLength={100}
          />
        </View>

        {/* Grade */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('routeForm.grade')} *</Text>
          <TrimmedTextInput
            style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }]}
            value={grade}
            onChangeText={setGrade}
            placeholder={t('routeForm.gradePlaceholder')}
            placeholderTextColor={colors.placeholderText}
            accessibilityLabel={t('routeForm.grade')}
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('routeForm.description')}</Text>
          <TrimmedTextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('routeForm.descriptionPlaceholder')}
            placeholderTextColor={colors.placeholderText}
            accessibilityLabel={t('routeForm.description')}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </View>

        {/* Photo Selection */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('routeForm.sprayWallPhoto')} *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoSelector}>
            {photos.map((photo) => (
              <TouchableOpacity
                key={photo.id}
                style={[
                  styles.photoOption,
                  { borderColor: colors.border },
                  selectedPhotoId === photo.id && { borderColor: colors.primary, borderWidth: 3 },
                ]}
                onPress={() => setSelectedPhotoId(photo.id)}
              >
                <Image source={{ uri: photo.image_url }} style={styles.photoThumbnail} />
                <Text style={[styles.photoDate, { backgroundColor: colors.cardBackground, color: colors.textPrimary }]}>
                  {formatDate(photo.setup_date)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Hold Placement */}
        {selectedPhoto && displayWidth > 0 && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{t('routeForm.routePreview', { count: holds.length })}</Text>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>{t('routeForm.tapToEdit')}</Text>
            <TouchableOpacity
              style={[styles.imageContainer, { backgroundColor: colors.cardBackground }]}
              onPress={() => setEditorVisible(true)}
              activeOpacity={0.8}
              testID="open-hold-editor"
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
              <View style={[styles.holdsList, { backgroundColor: colors.screenBackground }]}>
                <Text style={[styles.holdsListTitle, { color: colors.textSecondary }]}>{t('routeForm.holdsListTitle')}</Text>
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
      <View style={[styles.stickyFooter, { backgroundColor: colors.screenBackground, borderTopColor: colors.border }]}>
        <View style={styles.footerButtons}>
          {isEditMode && (
            <TouchableOpacity
              style={[styles.footerButton, { backgroundColor: colors.danger }]}
              onPress={handleDelete}
              disabled={saving}
            >
              <Text style={styles.footerButtonText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.footerButton, { backgroundColor: colors.primary }, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.footerButtonText}>
                {isEditMode ? t('routeForm.saveChanges') : t('routeForm.createRoute')}
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
  },
  form: {
    padding: 20,
  },
  stickyFooter: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
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
    borderRadius: 8,
    overflow: 'hidden',
  },
  photoThumbnail: {
    width: 100,
    height: 100,
  },
  photoDate: {
    fontSize: 10,
    textAlign: 'center',
    padding: 4,
  },
  imageContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  holdsList: {
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  holdsListTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  holdItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 6,
    padding: 10,
    marginVertical: 3,
    borderWidth: 1,
  },
  holdItemText: {
    fontSize: 14,
    flex: 1,
  },
  holdItemButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dragHandle: {
    fontSize: 18,
  },
  holdActionButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
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
  buttonDisabled: {
    opacity: 0.6,
  },
  footerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
