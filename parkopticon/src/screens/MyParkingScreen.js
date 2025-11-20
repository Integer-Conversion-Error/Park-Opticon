import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Modal } from 'react-native';
import { Button, Card } from '../components';
import { theme } from '../theme';
import * as Location from 'expo-location';

export default function MyParkingScreen({ navigation }) {
  const [isParked, setIsParked] = useState(false);
  const [parkingSession, setParkingSession] = useState(null);
  const [nearbyAlerts, setNearbyAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  
  // Mock vehicles (in production, this would come from user profile)
  const vehicles = [
    { id: '1', name: 'Blue Honda Civic', plate: 'ABC-1234', isDefault: true },
    { id: '2', name: 'White Toyota Camry', plate: 'XYZ-5678', isDefault: false },
  ];

  // Mock nearby alerts (in production, this would come from API)
  useEffect(() => {
    if (isParked && parkingSession) {
      // Simulate checking for nearby enforcement alerts
      const mockAlerts = [
        {
          id: '1',
          type: 'ticketing',
          distance: '0.2 miles',
          location: 'Main St & 5th Ave',
          time: '5 min ago',
          severity: 'high',
        },
      ];
      setNearbyAlerts(mockAlerts);
    } else {
      setNearbyAlerts([]);
    }
  }, [isParked, parkingSession]);

  // Set default vehicle on mount
  useEffect(() => {
    const defaultVehicle = vehicles.find(v => v.isDefault) || vehicles[0];
    setSelectedVehicle(defaultVehicle);
  }, []);

  const handleParkHere = async () => {
    // If multiple vehicles, show selection modal
    if (vehicles.length > 1) {
      setShowVehicleModal(true);
      return;
    }

    // If single vehicle, park immediately
    if (vehicles.length === 1) {
      startParkingSession(vehicles[0]);
    } else {
      Alert.alert('No Vehicle', 'Please add a vehicle in your Profile settings first.');
    }
  };

  const startParkingSession = async (vehicle) => {
    setShowVehicleModal(false);
    setLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to park here.');
        setLoading(false);
        return;
      }

      // For testing: Use emulator location or device GPS
      const location = await Location.getCurrentPositionAsync({});
      
      // Reverse geocode to get address
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      let addressStr = 'Current Location';
      if (address[0]) {
        const addr = address[0];
        addressStr = `${addr.street || ''} ${addr.city || ''}, ${addr.region || ''}`.trim();
      }

      const session = {
        id: Date.now().toString(),
        startTime: new Date(),
        location: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        address: addressStr,
        vehicle: vehicle,
      };

      setParkingSession(session);
      setIsParked(true);
      setLoading(false);

      Alert.alert(
        'Parking Started! 🚗',
        `${vehicle.name} is now parked. You'll receive alerts if enforcement is reported nearby.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Could not get your location. Please try again.');
    }
  };

  const handleEndParking = () => {
    Alert.alert(
      'End Parking Session?',
      'Are you sure you want to end your parking session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Parking',
          style: 'destructive',
          onPress: () => {
            setIsParked(false);
            setParkingSession(null);
            setNearbyAlerts([]);
            Alert.alert('Session Ended', 'Your parking session has been ended.');
          },
        },
      ]
    );
  };

  const formatDuration = (startTime) => {
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000); // seconds
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high':
        return theme.colors.error;
      case 'medium':
        return theme.colors.warning;
      default:
        return theme.colors.info;
    }
  };

  // Not parked view - One-click parking
  if (!isParked) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>🅿️ Quick Park</Text>
          <Text style={styles.subtitle}>
            Tap below to start your parking session. We'll auto-detect your location and alert you to any nearby enforcement activity.
          </Text>
        </View>

        <View style={styles.parkButtonContainer}>
          <Button
            title="Park Here"
            onPress={handleParkHere}
            size="large"
            loading={loading}
            style={styles.parkButton}
          />
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What happens when you park?</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>Your location is automatically detected</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🔔</Text>
            <Text style={styles.infoText}>You'll receive enforcement alerts nearby</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🗺️</Text>
            <Text style={styles.infoText}>Your car appears on your map</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🔒</Text>
            <Text style={styles.infoText}>Only you can see your parking location</Text>
          </View>
        </View>

        <Text style={styles.privacyNote}>
          🔒 Privacy: Your parking location is private and not shared with other users.
        </Text>

        {/* Vehicle Selection Modal */}
        <Modal
          visible={showVehicleModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowVehicleModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Vehicle</Text>
              
              {vehicles.map((vehicle) => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.vehicleOption,
                    selectedVehicle?.id === vehicle.id && styles.vehicleOptionSelected,
                  ]}
                  onPress={() => setSelectedVehicle(vehicle)}
                >
                  <View style={styles.vehicleOptionInfo}>
                    <Text style={styles.vehicleOptionName}>{vehicle.name}</Text>
                    <Text style={styles.vehicleOptionPlate}>{vehicle.plate}</Text>
                  </View>
                  {selectedVehicle?.id === vehicle.id && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}

              <View style={styles.modalButtons}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowVehicleModal(false)}
                  style={styles.modalButton}
                />
                <Button
                  title="Park"
                  onPress={() => startParkingSession(selectedVehicle)}
                  style={styles.modalButton}
                />
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  // Active parking session view
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.activeHeader}>
        <Text style={styles.activeTitle}>🚗 Currently Parked</Text>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{formatDuration(parkingSession.startTime)}</Text>
        </View>
      </View>

      <Card style={styles.sessionCard}>
        <View style={styles.sessionRow}>
          <Text style={styles.sessionLabel}>Vehicle:</Text>
          <Text style={styles.sessionValue}>{parkingSession.vehicle.name}</Text>
        </View>
        <View style={styles.sessionRow}>
          <Text style={styles.sessionLabel}>Plate:</Text>
          <Text style={styles.sessionValue}>{parkingSession.vehicle.plate}</Text>
        </View>
        <View style={styles.sessionRow}>
          <Text style={styles.sessionLabel}>Location:</Text>
          <Text style={styles.sessionValue}>{parkingSession.address}</Text>
        </View>
        <View style={styles.sessionRow}>
          <Text style={styles.sessionLabel}>Started:</Text>
          <Text style={styles.sessionValue}>
            {parkingSession.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </Card>

      {nearbyAlerts.length > 0 && (
        <View style={styles.alertsSection}>
          <Text style={styles.alertsTitle}>⚠️ Nearby Enforcement Alerts</Text>
          {nearbyAlerts.map((alert) => (
            <View
              key={alert.id}
              style={[styles.alertCard, { borderLeftColor: getSeverityColor(alert.severity) }]}
            >
              <View style={styles.alertHeader}>
                <Text style={styles.alertType}>
                  {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}
                </Text>
                <Text style={styles.alertDistance}>{alert.distance} away</Text>
              </View>
              <Text style={styles.alertLocation}>{alert.location}</Text>
              <Text style={styles.alertTime}>{alert.time}</Text>
            </View>
          ))}
        </View>
      )}

      <Button
        title="End Parking"
        variant="danger"
        onPress={handleEndParking}
        style={styles.endButton}
      />
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
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  parkButtonContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.xl,
  },
  parkButton: {
    minWidth: 200,
    paddingVertical: theme.spacing.lg,
  },
  infoSection: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  infoIcon: {
    fontSize: 24,
    marginRight: theme.spacing.sm,
    width: 32,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
  },
  privacyNote: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  activeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  durationBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 20,
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.white,
  },
  sessionCard: {
    marginBottom: theme.spacing.lg,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  sessionLabel: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  sessionValue: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  alertsSection: {
    marginBottom: theme.spacing.lg,
  },
  alertsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  alertCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  alertType: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  alertDistance: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  alertLocation: {
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  endButton: {
    marginTop: theme.spacing.md,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: theme.spacing.lg,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  vehicleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: 8,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border.light,
  },
  vehicleOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  vehicleOptionInfo: {
    flex: 1,
  },
  vehicleOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  vehicleOptionPlate: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  checkmark: {
    fontSize: 24,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: theme.spacing.xs,
  },
});
