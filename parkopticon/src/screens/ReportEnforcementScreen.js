import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components';
import { theme } from '../theme';
import { appendReport } from '../services/localStore';
import { api, apiAvailable } from '../services/api';
import { getFastLocation } from '../services/locationService';

const MAX_REPORT_ACCURACY_METERS = 50;

const REPORT_TYPES = [
  { value: 'chalking', icon: 'create-outline', title: 'Chalking', color: theme.colors.secondary },
  { value: 'ticketing', icon: 'ticket-outline', title: 'Ticketing', color: theme.colors.error },
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

      <View accessibilityViewIsModal style={[styles.sheet, { marginBottom: insets.bottom + theme.spacing.md }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Report enforcement</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close report enforcement"
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.typeGrid}>
          {REPORT_TYPES.map((type) => {
            const selected = selectedType === type.value;
            return (
              <Pressable
                key={type.value}
                accessibilityRole="radio"
                accessibilityLabel={`${type.title} enforcement activity`}
                accessibilityHint="Selects this report type"
                accessibilityState={{ selected }}
                onPress={() => { setSelectedType(type.value); setSubmitError(''); }}
                style={[styles.typeCard, selected && styles.typeCardSelected]}
              >
                <View style={[styles.typeIcon, { backgroundColor: selected ? `${type.color}20` : theme.colors.surfaceSubtle }]}>
                  <Ionicons name={type.icon} size={25} color={selected ? type.color : theme.colors.textSecondary} />
                </View>
                <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>{type.title}</Text>
                {selected ? <Ionicons name="checkmark-circle" size={17} color={type.color} style={styles.typeCheck} /> : null}
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

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(18,35,45,0.18)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, borderRadius: 20, borderWidth: 1, marginHorizontal: theme.spacing.md, padding: 12, ...theme.shadows.large },
  handle: { alignSelf: 'center', backgroundColor: theme.colors.border.medium, borderRadius: 2, height: 4, marginBottom: 6, width: 28 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: theme.colors.text, fontSize: 17, fontWeight: '800' },
  closeButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', marginLeft: 4, width: 44 },
  typeGrid: { flexDirection: 'row', gap: 6, marginTop: 10 },
  typeCard: { alignItems: 'center', backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, borderRadius: 12, borderWidth: 1, flex: 1, minHeight: 84, justifyContent: 'center', padding: 6 },
  typeCardSelected: { borderColor: theme.colors.primary, borderWidth: 2 },
  typeIcon: { alignItems: 'center', borderRadius: 12, height: 38, justifyContent: 'center', width: 38 },
  typeLabel: { color: theme.colors.text, fontSize: 14, fontWeight: '800', marginTop: 3 },
  typeLabelSelected: { color: theme.colors.primaryDark },
  typeCheck: { marginTop: 1 },
  error: { color: theme.colors.error, fontSize: 12, lineHeight: 17, marginTop: 6, textAlign: 'center' },
  submitButton: { borderRadius: 14, marginTop: 10, minHeight: 50 },
});
