import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Marker } from 'react-native-maps';
import { formatTimeAgo, getReportMeta } from '../services/localStore';
import { useThemedStyles } from '../theme';

const SNAPSHOT_SETTLE_MS = 700;

export default function ReportMarker({ report, isStale, isSelected, onPress }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const [fontLoaded] = useFonts(Ionicons.font);
  const [laidOut, setLaidOut] = useState(false);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const meta = getReportMeta(report);
  const fill = isStale ? theme.colors.textMuted : meta.color;
  const glyph = isStale && theme.dark ? theme.colors.background : theme.colors.white;

  useEffect(() => {
    // Native maps snapshot custom views. Wait for layout and the icon font,
    // then take a final snapshot; refresh it when its visible state changes.
    setTracksViewChanges(true);
    if (!laidOut || !fontLoaded) return undefined;
    const timer = setTimeout(() => setTracksViewChanges(false), SNAPSHOT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [laidOut, fontLoaded, fill, glyph, isSelected, theme.dark]);

  return (
    <Marker
      coordinate={{ latitude: report.latitude, longitude: report.longitude }}
      onPress={onPress}
      style={styles.target}
      tracksViewChanges={tracksViewChanges}
      accessible
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${isStale ? 'Stale open spot' : meta.label}, ${formatTimeAgo(report.createdAt)}. Double tap for details.`}
      accessibilityHint="Opens report details and verification options"
    >
      <View collapsable={false} onLayout={() => setLaidOut(true)} style={styles.target}>
        <View style={[styles.marker, { backgroundColor: fill }, isSelected && styles.selected]}>
          <Ionicons name={meta.icon} size={16} color={glyph} />
        </View>
      </View>
    </Marker>
  );
}

const createStyles = (theme) => StyleSheet.create({
  target: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  marker: { alignItems: 'center', borderColor: theme.colors.white, borderRadius: 18, borderWidth: 2, elevation: 3, height: 36, justifyContent: 'center', width: 36 },
  selected: { borderColor: theme.colors.primary, borderWidth: 3, transform: [{ scale: 1.12 }] },
});
