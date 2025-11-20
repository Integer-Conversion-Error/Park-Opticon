import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Image } from 'react-native';
import { Button, Input } from '../components';
import { theme } from '../theme';
import * as ImagePicker from 'expo-image-picker';

export default function ReportParkingScreen({ navigation, route }) {
  const { coordinate } = route.params || {};
  
  const [formData, setFormData] = useState({
    location: coordinate ? `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}` : '',
    address: '',
    duration: '',
    notes: '',
    photos: [],
  });

  const [errors, setErrors] = useState({});

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData({
        ...formData,
        photos: [...formData.photos, result.assets[0].uri],
      });
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData({
        ...formData,
        photos: [...formData.photos, result.assets[0].uri],
      });
    }
  };

  const removePhoto = (index) => {
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    setFormData({ ...formData, photos: newPhotos });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.duration.trim()) {
      newErrors.duration = 'Expected duration is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    // TODO: Submit to backend API
    Alert.alert(
      'Success!',
      'Your parking spot has been reported. Thank you for helping the community!',
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Report Parking Spot</Text>
        <Text style={styles.subtitle}>
          Help others find parking by sharing available spots
        </Text>
      </View>

      {/* Location (read-only from map) */}
      <View style={styles.section}>
        <Text style={styles.label}>Location Coordinates</Text>
        <Input
          value={formData.location}
          editable={false}
          placeholder="Tap map to set location"
          style={styles.disabledInput}
        />
      </View>

      {/* Address */}
      <View style={styles.section}>
        <Input
          label="Street Address *"
          value={formData.address}
          onChangeText={(text) => setFormData({ ...formData, address: text })}
          placeholder="e.g., 123 Main St"
          error={errors.address}
        />
      </View>

      {/* Expected Duration */}
      <View style={styles.section}>
        <Input
          label="How long will it be available? *"
          value={formData.duration}
          onChangeText={(text) => setFormData({ ...formData, duration: text })}
          placeholder="e.g., 2 hours, 30 minutes"
          error={errors.duration}
        />
      </View>

      {/* Additional Notes */}
      <View style={styles.section}>
        <Input
          label="Additional Details (Optional)"
          value={formData.notes}
          onChangeText={(text) => setFormData({ ...formData, notes: text })}
          placeholder="e.g., Next to blue building, metered spot"
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Photos */}
      <View style={styles.section}>
        <Text style={styles.label}>Photos (Optional)</Text>
        <Text style={styles.helperText}>
          Add photos to help others locate the spot
        </Text>

        <View style={styles.photoButtons}>
          <Button
            title="Take Photo"
            onPress={takePhoto}
            variant="outline"
            size="small"
            style={styles.photoButton}
          />
          <Button
            title="Choose from Library"
            onPress={pickImage}
            variant="outline"
            size="small"
            style={styles.photoButton}
          />
        </View>

        {formData.photos.length > 0 && (
          <View style={styles.photoGrid}>
            {formData.photos.map((uri, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => removePhoto(index)}
                >
                  <Text style={styles.removePhotoText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>ℹ️</Text>
        <Text style={styles.infoText}>
          Your report will be visible to other users for the duration you specify. 
          Thank you for contributing to the community!
        </Text>
      </View>

      {/* Submit Buttons */}
      <View style={styles.actions}>
        <Button
          title="Cancel"
          onPress={() => navigation.goBack()}
          variant="outline"
          style={styles.actionButton}
        />
        <Button
          title="Submit Report"
          onPress={handleSubmit}
          variant="primary"
          style={styles.actionButton}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  helperText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  disabledInput: {
    backgroundColor: theme.colors.surface,
    opacity: 0.6,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  photoButton: {
    flex: 1,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  photoContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: theme.colors.error,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  removePhotoText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.info + '20',
    padding: theme.spacing.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.info,
    marginBottom: theme.spacing.lg,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
