import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { theme } from '../theme';

export default function MapScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [parkingSpots, setParkingSpots] = useState([
    {
      id: '1',
      latitude: 37.78825,
      longitude: -122.4324,
      title: 'Available Spot',
      description: '2 min ago',
      type: 'parking',
    },
  ]);
  const [enforcementAlerts, setEnforcementAlerts] = useState([
    {
      id: '2',
      latitude: 37.78925,
      longitude: -122.4334,
      title: 'Officer Spotted',
      description: '5 min ago',
      type: 'enforcement',
    },
  ]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this app.');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
  }, []);

  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    Alert.alert(
      'Quick Report',
      'What would you like to report at this location?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Available Parking',
          onPress: () => handleReportParking(coordinate),
        },
        {
          text: 'Enforcement Activity',
          onPress: () => handleReportEnforcement(coordinate),
        },
      ]
    );
  };

  const handleReportParking = (coordinate) => {
    const newSpot = {
      id: Date.now().toString(),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      title: 'New Parking Spot',
      description: 'Just now',
      type: 'parking',
    };
    setParkingSpots([...parkingSpots, newSpot]);
    Alert.alert('Success', 'Parking spot reported!');
  };

  const handleReportEnforcement = (coordinate) => {
    const newAlert = {
      id: Date.now().toString(),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      title: 'Enforcement Alert',
      description: 'Just now',
      type: 'enforcement',
    };
    setEnforcementAlerts([...enforcementAlerts, newAlert]);
    Alert.alert('Success', 'Enforcement alert reported!');
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={location || {
          latitude: 37.78825,
          longitude: -122.4324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        region={location}
        showsUserLocation
        showsMyLocationButton
        onPress={handleMapPress}
      >
        {/* Parking spot markers */}
        {parkingSpots.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={{
              latitude: spot.latitude,
              longitude: spot.longitude,
            }}
            title={spot.title}
            description={spot.description}
            pinColor={theme.colors.success}
          />
        ))}

        {/* Enforcement alert markers */}
        {enforcementAlerts.map((alert) => (
          <Marker
            key={alert.id}
            coordinate={{
              latitude: alert.latitude,
              longitude: alert.longitude,
            }}
            title={alert.title}
            description={alert.description}
            pinColor={theme.colors.error}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});
