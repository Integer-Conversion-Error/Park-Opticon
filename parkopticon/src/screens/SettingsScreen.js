import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '../services/localStore';
import { api, apiAvailable } from '../services/api';

const RADIUS_OPTIONS = [
  100, 250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500,
];
const SLIDER_TRACK_INSET = 12;

const formatRadius = (meters) => {
  if (meters < 1000) return `${meters} m`;
  const kilometres = meters / 1000;
  return `${Number.isInteger(kilometres) ? kilometres : kilometres.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} km`;
};

function NotchedSlider({
  options,
  value,
  onValueChange,
  onSlidingComplete,
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const selectedIndex = Math.max(0, options.indexOf(value));
  const progress = selectedIndex / (options.length - 1);

  const optionAtLocation = useCallback(
    (locationX) => {
      if (!trackWidth || typeof locationX !== 'number') return value;

      const railWidth = Math.max(trackWidth - SLIDER_TRACK_INSET * 2, 1);
      const position = Math.max(
        0,
        Math.min((locationX - SLIDER_TRACK_INSET) / railWidth, 1)
      );
      return options[Math.round(position * (options.length - 1))];
    },
    [options, trackWidth, value]
  );

  const selectAtLocation = useCallback(
    (locationX) => {
      const nextValue = optionAtLocation(locationX);
      if (nextValue !== value) onValueChange(nextValue);
      return nextValue;
    },
    [onValueChange, optionAtLocation, value]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) =>
          selectAtLocation(event.nativeEvent.locationX),
        onPanResponderMove: (event) =>
          selectAtLocation(event.nativeEvent.locationX),
        onPanResponderRelease: (event) =>
          onSlidingComplete(selectAtLocation(event.nativeEvent.locationX)),
        onPanResponderTerminate: (event) =>
          onSlidingComplete(selectAtLocation(event.nativeEvent.locationX)),
      }),
    [onSlidingComplete, selectAtLocation]
  );

  const moveByStep = (step) => {
    const nextIndex = Math.max(
      0,
      Math.min(selectedIndex + step, options.length - 1)
    );
    const nextValue = options[nextIndex];
    if (nextValue === value) return;
    onValueChange(nextValue);
    onSlidingComplete(nextValue);
  };

  return (
    <View>
      <View
        {...panResponder.panHandlers}
        accessible
        accessibilityActions={[
          { name: 'decrement', label: 'Decrease alert radius' },
          { name: 'increment', label: 'Increase alert radius' },
        ]}
        accessibilityHint="Swipe left or right to choose an alert distance"
        accessibilityLabel="Alert radius"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: options[0],
          max: options[options.length - 1],
          now: value,
          text: formatRadius(value),
        }}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'increment') moveByStep(1);
          if (nativeEvent.actionName === 'decrement') moveByStep(-1);
        }}
        onLayout={({ nativeEvent }) => setTrackWidth(nativeEvent.layout.width)}
        style={styles.radiusSlider}
      >
        <View pointerEvents="none" style={styles.radiusSliderRail}>
          <View style={styles.radiusSliderTrack} />
          <View
            style={[
              styles.radiusSliderFill,
              { width: `${progress * 100}%` },
            ]}
          />
          <View style={styles.radiusSliderNotches}>
            {options.map((option, index) => (
              <View
                key={option}
                style={[
                  styles.radiusSliderNotch,
                  index <= selectedIndex && styles.radiusSliderNotchActive,
                ]}
              />
            ))}
          </View>
          <View
            style={[
              styles.radiusSliderThumb,
              { left: `${progress * 100}%` },
            ]}
          >
            <View style={styles.radiusSliderThumbCenter} />
          </View>
        </View>
      </View>
      <View style={styles.radiusSliderLabels}>
        <Text style={styles.radiusSliderLabel}>{formatRadius(options[0])}</Text>
        <Text style={styles.radiusSliderLabel}>1 km</Text>
        <Text style={styles.radiusSliderLabel}>
          {formatRadius(options[options.length - 1])}
        </Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const isFocused = useIsFocused();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!isFocused) return undefined;
    let mounted = true;
    Promise.all([
      loadSettings(),
      apiAvailable() ? api.preferences() : Promise.resolve(null),
    ])
      .then(([local, remote]) => {
        if (!mounted) return;
        setSettings(
          remote
            ? {
                notificationsEnabled: remote.notifications_enabled,
                notificationRadiusMeters: remote.notification_radius_meters,
                askAboutEnforcementAfterParking:
                  remote.ask_about_enforcement_after_parking,
                announceOpenSpotAfterUnparking:
                  remote.announce_open_spot_after_unparking,
              }
            : local
        );
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isFocused]);

  const updateSettings = async (nextSettings) => {
    setSettings(nextSettings);
    await saveSettings(nextSettings);
    if (apiAvailable()) {
      try {
        await api.updatePreferences({
          notifications_enabled: nextSettings.notificationsEnabled,
          notification_radius_meters: nextSettings.notificationRadiusMeters,
          ask_about_enforcement_after_parking:
            nextSettings.askAboutEnforcementAfterParking,
          announce_open_spot_after_unparking:
            nextSettings.announceOpenSpotAfterUnparking,
        });
      } catch {
        // Keep the local setting visible; the next focused load reconciles it.
      }
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerRule} />
        <Text style={styles.eyebrow}>YOUR CONTROL CENTER</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Choose when Parkopticon should notify you and how far alerts can reach.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Nearby enforcement alerts</Text>
            <Text style={styles.rowSubtitle}>
              Get warnings while your car is parked.
            </Text>
          </View>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={(value) =>
              updateSettings({ ...settings, notificationsEnabled: value })
            }
            trackColor={{ false: '#CBD5E1', true: '#9CC7F4' }}
            thumbColor={
              settings.notificationsEnabled ? theme.colors.primary : '#F8FAFC'
            }
          />
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionLabel}>ALERT RADIUS</Text>
        <Text style={styles.radiusDescription}>
          Drag to choose how far reports and notifications can reach. Current
          radius:{' '}
          <Text style={styles.radiusValue}>
            {formatRadius(settings.notificationRadiusMeters)}
          </Text>
        </Text>
        <NotchedSlider
          options={RADIUS_OPTIONS}
          value={settings.notificationRadiusMeters}
          onValueChange={(radius) =>
            setSettings((current) => ({
              ...current,
              notificationRadiusMeters: radius,
            }))
          }
          onSlidingComplete={(radius) =>
            updateSettings({
              ...settings,
              notificationRadiusMeters: radius,
            })
          }
        />
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons
              name="car-outline"
              size={22}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Offer to share my open spot</Text>
            <Text style={styles.rowSubtitle}>
              When enabled, the main action becomes “Unpark & share.”
            </Text>
          </View>
          <Switch
            value={settings.announceOpenSpotAfterUnparking}
            onValueChange={(value) =>
              updateSettings({
                ...settings,
                announceOpenSpotAfterUnparking: value,
              })
            }
            trackColor={{ false: '#CBD5E1', true: '#9CC7F4' }}
            thumbColor={
              settings.announceOpenSpotAfterUnparking
                ? theme.colors.primary
                : '#F8FAFC'
            }
          />
        </View>
      </View>

      <View style={styles.infoCard}>
        <Ionicons
          name="shield-checkmark-outline"
          size={24}
          color={theme.colors.primary}
        />
        <View style={styles.infoCopy}>
          <Text style={styles.infoTitle}>Privacy first</Text>
          <Text style={styles.infoText}>
            Sharing an open spot never shares your name, vehicle, or
            parking-session details. Nearby drivers only see the spot location
            and expiry window.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#F7F9FC', flex: 1 },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  header: { marginBottom: theme.spacing.lg },
  headerRule: {
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    height: 4,
    marginBottom: theme.spacing.md,
    width: 32,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.border.light,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    ...theme.shadows.small,
  },
  row: { alignItems: 'center', flexDirection: 'row' },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 12,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  rowCopy: { flex: 1, marginHorizontal: theme.spacing.sm },
  rowTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  rowSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  divider: {
    backgroundColor: '#EDF0F5',
    height: 1,
    marginVertical: theme.spacing.md,
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  radiusDescription: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: theme.spacing.xs,
  },
  radiusValue: { color: theme.colors.primaryDark, fontWeight: '800' },
  radiusSlider: {
    height: 44,
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  radiusSliderRail: {
    height: 32,
    justifyContent: 'center',
    marginHorizontal: SLIDER_TRACK_INSET,
    position: 'relative',
  },
  radiusSliderTrack: {
    backgroundColor: '#D9E2EF',
    borderRadius: 2,
    height: 4,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 14,
  },
  radiusSliderFill: {
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    height: 4,
    left: 0,
    position: 'absolute',
    top: 14,
  },
  radiusSliderNotches: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 9,
  },
  radiusSliderNotch: {
    backgroundColor: '#B7C6D8',
    borderRadius: 1,
    height: 14,
    width: 2,
  },
  radiusSliderNotchActive: { backgroundColor: theme.colors.primary },
  radiusSliderThumb: {
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    borderWidth: 3,
    height: 24,
    justifyContent: 'center',
    marginLeft: -12,
    position: 'absolute',
    top: 4,
    width: 24,
    ...theme.shadows.small,
  },
  radiusSliderThumbCenter: {
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  radiusSliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -2,
  },
  radiusSliderLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  infoCard: {
    alignItems: 'flex-start',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 14,
    flexDirection: 'row',
    padding: theme.spacing.md,
  },
  infoCopy: { flex: 1, marginLeft: theme.spacing.sm },
  infoTitle: {
    color: theme.colors.primaryDark,
    fontSize: 14,
    fontWeight: '800',
  },
  infoText: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
});
