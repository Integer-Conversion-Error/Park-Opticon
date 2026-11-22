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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../theme';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '../services/localStore';
import { api, apiAvailable } from '../services/api';
import { NOTIFICATION_RADIUS_OPTIONS, normalizeNotificationRadius } from '../services/notificationSettings';

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
  const { styles } = useThemedStyles(createStyles);
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
        testID="settings-alert-radius"
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
        <Text style={styles.radiusSliderLabel}>{formatRadius(options[Math.floor(options.length / 2)])}</Text>
        <Text style={styles.radiusSliderLabel}>
          {formatRadius(options[options.length - 1])}
        </Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { theme, styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
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
                notificationRadiusMeters: normalizeNotificationRadius(remote.notification_radius_meters),
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + theme.spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionLabel}>Notifications</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Nearby enforcement alerts</Text>
          <Switch
            style={styles.settingSwitch}
            accessibilityLabel="Nearby enforcement alerts"
            testID="settings-notifications-switch"
            value={settings.notificationsEnabled}
            onValueChange={(value) =>
              updateSettings({ ...settings, notificationsEnabled: value })
            }
            trackColor={{ false: theme.colors.border.medium, true: theme.colors.primary }}
            thumbColor={theme.colors.white}
            ios_backgroundColor={theme.colors.border.medium}
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.radiusHeader}>
          <Text style={styles.radiusTitle}>Alert radius</Text>
          <Text accessibilityLiveRegion="polite" style={styles.radiusValue}>
            {formatRadius(settings.notificationRadiusMeters)}
          </Text>
        </View>
        <NotchedSlider
          options={NOTIFICATION_RADIUS_OPTIONS}
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
      <Text style={styles.groupFootnote}>
        Get community enforcement alerts near your parked location.
      </Text>

      <Text style={styles.sectionLabel}>Parking</Text>
      <View style={[styles.card, styles.singleRowCard]}>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>Offer to share my open spot</Text>
          <Switch
            style={styles.settingSwitch}
            accessibilityLabel="Offer to share my open spot"
            testID="settings-share-open-spot-switch"
            value={settings.announceOpenSpotAfterUnparking}
            onValueChange={(value) =>
              updateSettings({
                ...settings,
                announceOpenSpotAfterUnparking: value,
              })
            }
            trackColor={{ false: theme.colors.border.medium, true: theme.colors.primary }}
            thumbColor={theme.colors.white}
            ios_backgroundColor={theme.colors.border.medium}
          />
        </View>
      </View>
      <Text style={styles.groupFootnote}>
        When you unpark, share an approximate location with nearby drivers.
        Your name, vehicle, and private parking session stay private.
      </Text>
    </ScrollView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: { backgroundColor: theme.colors.background, flex: 1 },
  content: { paddingHorizontal: theme.spacing.lg, paddingTop: 20 },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 3,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 16,
  },
  singleRowCard: { paddingBottom: 0 },
  row: { alignItems: 'center', flexDirection: 'row', minHeight: 68 },
  settingSwitch: { minHeight: 44, minWidth: 44 },
  rowTitle: { color: theme.colors.text, flex: 1, fontSize: 15, fontWeight: '500', lineHeight: 22, marginRight: 12 },
  divider: { backgroundColor: theme.colors.border.light, height: StyleSheet.hairlineWidth },
  radiusHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 17 },
  radiusTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '400' },
  radiusValue: { color: theme.colors.primaryDark, fontSize: 15, fontWeight: '600' },
  groupFootnote: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 28, marginHorizontal: 6, marginTop: 10 },
  radiusSlider: { height: 44, justifyContent: 'center', marginTop: 7 },
  radiusSliderRail: { height: 32, justifyContent: 'center', marginHorizontal: SLIDER_TRACK_INSET, position: 'relative' },
  radiusSliderTrack: { backgroundColor: theme.colors.border.medium, borderRadius: 2, height: 4, left: 0, position: 'absolute', right: 0, top: 14 },
  radiusSliderFill: { backgroundColor: theme.colors.primaryDark, borderRadius: 2, height: 4, left: 0, position: 'absolute', top: 14 },
  radiusSliderNotches: { flexDirection: 'row', justifyContent: 'space-between', left: 0, position: 'absolute', right: 0, top: 12 },
  radiusSliderNotch: { backgroundColor: theme.colors.border.medium, borderRadius: 1, height: 8, width: 2 },
  radiusSliderNotchActive: { backgroundColor: theme.colors.primaryDark },
  radiusSliderThumb: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primaryDark,
    borderRadius: 12,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    marginLeft: -12,
    position: 'absolute',
    top: 4,
    width: 24,
    ...theme.shadows.small,
  },
  radiusSliderThumbCenter: { backgroundColor: theme.colors.primaryDark, borderRadius: 3, height: 6, width: 6 },
  radiusSliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  radiusSliderLabel: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '400' },
});
