import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Image } from 'react-native';
import { Button, Input } from '../components';
import { theme } from '../theme';
import * as ImagePicker from 'expo-image-picker';

export default function ReportEnforcementScreen({ navigation, route }) {
  const { coordinate } = route.params || {};
  
  const [formData, setFormData] = useState({
    location: coordinate ? `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}` : '',
    address: '',
    enforcementType: 'ticketing', // ticketing, chalking, towing
    description: '',
    photos: [],
  });

  const [errors, setErrors] = useState({});

  const enforcementTypes = [
    { value: 'ticketing', label: '🎫 Ticketing', color: theme.colors.error },
    { value: 'chalking', label: '✏️ Chalking', color: theme.colors.warning },
    { value: 'towing', label: '🚛 Towing', color: theme.colors.danger },
  ];

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

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
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
      'Alert Submitted!',
      'Your enforcement alert has been reported. Other users will be notified.',
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
        <Text style={styles.title}>Report Enforcement</Text>
        <Text style={styles.subtitle}>
          Alert the community about parking enforcement activity
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

      {/* Enforcement Type */}
      <View style={styles.section}>
        <Text style={styles.label}>Enforcement Type *</Text>
        <View style={styles.typeButtons}>
          {enforcementTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.typeButton,
                formData.enforcementType === type.value && styles.typeButtonActive,
                formData.enforcementType === type.value && { borderColor: type.color },
              ]}
              onPress={() => setFormData({ ...formData, enforcementType: type.value })}
            >
              <Text style={[
                styles.typeButtonText,
                formData.enforcementType === type.value && styles.typeButtonTextActive,
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Input
          label="Description *"
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          placeholder="e.g., Officer writing tickets on north side of street"
          multiline
          numberOfLines={3}
          error={errors.description}
        />
      </View>

      {/* Photos */}
      <View style={styles.section}>
        <Text style={styles.label}>Photos (Optional)</Text>
        <Text style={styles.helperText}>
          Photos help verify enforcement activity
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

      {/* Warning Box */}
      <View style={styles.warningBox}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningText}>
          Only report confirmed enforcement activity. False reports may result in account suspension.
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
          title="Submit Alert"
          onPress={handleSubmit}
          variant="error"
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
  typeButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
  },
  typeButtonText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: theme.colors.text,
    fontWeight: '600',
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
  warningBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.warning + '20',
    padding: theme.spacing.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning,
    marginBottom: theme.spacing.lg,
  },
  warningIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  warningText: {
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
