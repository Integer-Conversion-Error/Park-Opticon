import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Card, Button } from '../components';
import { theme } from '../theme';

export default function ProfileScreen({ navigation }) {
  const [vehicles, setVehicles] = useState([
    { id: '1', name: 'Blue Honda Civic', plate: 'ABC-1234', isDefault: true },
    { id: '2', name: 'White Toyota Camry', plate: 'XYZ-5678', isDefault: false },
  ]);

  const handleAddVehicle = () => {
    Alert.alert('Add Vehicle', 'Vehicle management feature coming soon!');
  };

  const handleEditVehicle = (vehicle) => {
    Alert.alert('Edit Vehicle', `Edit ${vehicle.name}`);
  };

  const handleSetDefault = (vehicleId) => {
    setVehicles(vehicles.map(v => ({
      ...v,
      isDefault: v.id === vehicleId
    })));
    Alert.alert('Success', 'Default vehicle updated');
  };

  const userStats = {
    spotsReported: 42,
    alertsReported: 18,
    helpedOthers: 60,
    reputation: 87,
  };

  const settings = [
    { id: '1', title: 'Notifications', subtitle: 'Manage your alerts', icon: '🔔' },
    { id: '2', title: 'Location', subtitle: 'Location permissions', icon: '📍' },
    { id: '3', title: 'Privacy', subtitle: 'Data and privacy settings', icon: '🔒' },
    { id: '4', title: 'Help & Support', subtitle: 'FAQs and contact', icon: '❓' },
    { id: '5', title: 'About', subtitle: 'Version 1.0.0', icon: 'ℹ️' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User info */}
      <View style={styles.userSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <Text style={styles.userName}>Parking Hero</Text>
        <Text style={styles.userEmail}>user@parkopticon.app</Text>
        <Button
          title="Edit Profile"
          variant="outline"
          size="small"
          onPress={() => console.log('Edit profile')}
          style={styles.editButton}
        />
      </View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Your Impact</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userStats.spotsReported}</Text>
            <Text style={styles.statLabel}>Spots Reported</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userStats.alertsReported}</Text>
            <Text style={styles.statLabel}>Alerts Sent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{userStats.helpedOthers}</Text>
            <Text style={styles.statLabel}>People Helped</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: theme.colors.success }]}>
              {userStats.reputation}%
            </Text>
            <Text style={styles.statLabel}>Reputation</Text>
          </View>
        </View>
      </View>

      {/* Achievements */}
      <View style={styles.achievementsSection}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.achievementsBadges}>
          <View style={styles.badge}>
            <Text style={styles.badgeEmoji}>🏆</Text>
            <Text style={styles.badgeText}>Top Reporter</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeEmoji}>⭐</Text>
            <Text style={styles.badgeText}>Early Adopter</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeEmoji}>🎯</Text>
            <Text style={styles.badgeText}>Accurate</Text>
          </View>
        </View>
      </View>

      {/* My Vehicles */}
      <View style={styles.vehiclesSection}>
        <Text style={styles.sectionTitle}>🚗 My Vehicles</Text>
        {vehicles.map((vehicle) => (
          <TouchableOpacity
            key={vehicle.id}
            style={styles.vehicleCard}
            onPress={() => handleEditVehicle(vehicle)}
          >
            <View style={styles.vehicleInfo}>
              <View style={styles.vehicleHeader}>
                <Text style={styles.vehicleName}>{vehicle.name}</Text>
                {vehicle.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>
              <Text style={styles.vehiclePlate}>Plate: {vehicle.plate}</Text>
            </View>
            {!vehicle.isDefault && (
              <TouchableOpacity
                style={styles.setDefaultButton}
                onPress={() => handleSetDefault(vehicle.id)}
              >
                <Text style={styles.setDefaultText}>Set Default</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}
        <Button
          title="+ Add Vehicle"
          onPress={handleAddVehicle}
          variant="outline"
          size="small"
          style={styles.addVehicleButton}
        />
      </View>

      {/* Settings */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Settings</Text>
        {settings.map((setting) => (
          <TouchableOpacity
            key={setting.id}
            style={styles.settingItem}
            onPress={() => console.log('Setting pressed:', setting.title)}
          >
            <View style={styles.settingLeft}>
              <Text style={styles.settingIcon}>{setting.icon}</Text>
              <View>
                <Text style={styles.settingTitle}>{setting.title}</Text>
                <Text style={styles.settingSubtitle}>{setting.subtitle}</Text>
              </View>
            </View>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout button */}
      <Button
        title="Logout"
        variant="danger"
        onPress={() => console.log('Logout')}
        style={styles.logoutButton}
      />

      <Text style={styles.version}>Parkopticon v1.0.0</Text>
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
  userSection: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  avatarText: {
    fontSize: 40,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  userEmail: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  editButton: {
    minWidth: 120,
  },
  statsSection: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.md,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  achievementsSection: {
    marginBottom: theme.spacing.md,
  },
  achievementsBadges: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  badge: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.sm,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  badgeEmoji: {
    fontSize: 32,
    marginBottom: theme.spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    color: theme.colors.text,
    textAlign: 'center',
  },
  vehiclesSection: {
    marginBottom: theme.spacing.md,
  },
  vehicleCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginRight: theme.spacing.sm,
  },
  vehiclePlate: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  defaultBadge: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.white,
  },
  setDefaultButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  setDefaultText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  addVehicleButton: {
    marginTop: theme.spacing.xs,
  },
  settingsSection: {
    marginBottom: theme.spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: theme.spacing.sm,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  settingSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 24,
    color: theme.colors.textSecondary,
  },
  logoutButton: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
});
