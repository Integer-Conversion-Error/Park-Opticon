import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components';
import { useThemedStyles } from '../theme';
import { appendReport } from '../services/localStore';
import { api, apiAvailable } from '../services/api';
import { getFastLocation } from '../services/locationService';

const MAX_REPORT_ACCURACY_METERS = 50;

const REPORT_TYPES = [
  { value: 'chalking', icon: 'create-outline', title: 'Chalking', colorKey: 'secondaryDark' },
  { value: 'ticketing', icon: 'ticket-outline', title: 'Ticketing', colorKey: 'error' },
];

const toReportLocation = (position) => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
});

const isAccurateEnough = (location) => (
  location && (!location.accuracy || location.accuracy <= MAX_REPORT_ACCURACY_METERS)
);

export default function ReportEnforcementScreen({ navigation, route }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const passedLocation = route?.params?.location;
  const [selectedType, setSelectedType] = useState(null);
  const [location, setLocation] = useState(() => (
    isAccurateEnough(passedLocation) ? passedLocation : null
  ));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const getReportLocation = useCallback(async () => {
    try {
      return toReportLocation(await getFastLocation({ allowStaleFallback: true }));
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (location) return undefined;
    let active = true;
    getReportLocation().then((nextLocation) => {
      if (active && isAccurateEnough(nextLocation)) setLocation(nextLocation);
    });
    return () => { active = false; };
  }, [getReportLocation, location]);

  const handleSubmit = async () => {
    if (!selectedType || submitting) return;

    setSubmitError('');
    setSubmitting(true);

    try {
      const reportLocation = isAccurateEnough(location)
        ? location
        : await getReportLocation();

      if (!isAccurateEnough(reportLocation)) throw new Error('location_unavailable');
      if (!location) setLocation(reportLocation);

      const report = {
        id: String(Date.now()),
        type: selectedType,
        latitude: Number(reportLocation.latitude.toFixed(4)),
        longitude: Number(reportLocation.longitude.toFixed(4)),
        accuracy: reportLocation.accuracy,
        address: 'Current location',
        createdAt: new Date().toISOString(),
        baseConfidence: 0.6,
        confidence: 0.6,
        confirmations: 0,
        disputes: 0,
        source: 'you',
        active: true,
      };

      if (apiAvailable()) {
        await api.createEnforcementAlert({
          latitude: reportLocation.latitude,
          longitude: reportLocation.longitude,
          accuracy_meters: reportLocation.accuracy,
          enforcement_type: selectedType,
          description: selectedType === 'chalking' ? 'Officer chalking tires' : 'Officer writing parking tickets',
        });
      } else {
        await appendReport(report);
      }

      navigation.goBack();
    } catch {
      setSubmitError('Couldn’t send this report yet. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.backdrop}>
      <Pressable
        accessible={false}
        onPress={() => navigation.goBack()}
        style={StyleSheet.absoluteFill}
      />

      <View accessibilityViewIsModal style={[styles.sheet, { marginBottom: insets.bottom + 8 }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Report enforcement</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close report enforcement"
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            <View style={styles.closeButtonIcon}><Ionicons name="close" size={18} color={theme.colors.textSecondary} /></View>
          </Pressable>
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel="Enforcement type" style={styles.typeGrid}>
          {REPORT_TYPES.map((type) => {
            const selected = selectedType === type.value;
            return (
              <Pressable
                key={type.value}
                accessibilityRole="radio"
                accessibilityLabel={`${type.title} enforcement activity`}
                accessibilityHint="Selects this report type"
                accessibilityState={{ selected, checked: selected }}
                onPress={() => { setSelectedType(type.value); setSubmitError(''); }}
                style={[styles.typeCard, selected && styles.typeCardSelected]}
              >
                <View style={styles.typeIcon}>
                  <Ionicons name={type.icon} size={26} color={theme.colors[type.colorKey]} />
                </View>
                <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>{type.title}</Text>
                <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={18} color={selected ? theme.colors.primaryDark : theme.colors.textSecondary} style={styles.typeCheck} />
              </Pressable>
            );
          })}
        </View>

        {submitError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{submitError}</Text> : null}

        <Button
          title="Send report"
          onPress={handleSubmit}
          variant="primary"
          size="medium"
          fullWidth
          loading={submitting}
          disabled={!selectedType}
          style={styles.submitButton}
        />
      </View>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  backdrop: { backgroundColor: theme.colors.backdrop, flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surface, borderRadius: 30, marginHorizontal: 9, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, ...theme.shadows.large },
  handle: { alignSelf: 'center', backgroundColor: theme.colors.border.medium, borderRadius: 2, height: 4, marginBottom: 10, width: 32 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  title: { color: theme.colors.text, flex: 1, fontSize: 21, fontWeight: '600', lineHeight: 27, letterSpacing: -0.4 },
  closeButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', marginLeft: 4, width: 44 },
  closeButtonIcon: { alignItems: 'center', backgroundColor: theme.colors.surfaceSubtle, borderRadius: 14, height: 28, justifyContent: 'center', width: 28 },
  typeGrid: { flexDirection: 'row', gap: 10 },
  typeCard: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, borderRadius: 18, borderWidth: 1.5, flex: 1, minHeight: 100, justifyContent: 'center', padding: 12 },
  typeCardSelected: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primaryDark },
  typeIcon: { alignItems: 'center', height: 32, justifyContent: 'center', width: 32 },
  typeLabel: { color: theme.colors.text, fontSize: 15, fontWeight: '600', marginTop: 10 },
  typeLabelSelected: { color: theme.colors.text },
  typeCheck: { position: 'absolute', right: 10, top: 10 },
  error: { color: theme.colors.error, fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: 'center' },
  submitButton: { borderRadius: 16, marginTop: 16, minHeight: 50 },
});
