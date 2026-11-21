import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components';
import ReportMarker from '../components/ReportMarker';
import { useThemedStyles } from '../theme';
import {
  DEFAULT_SETTINGS,
  applyVerification,
  appendReport,
  distanceMeters,
  formatTimeAgo,
  getReportMeta,
  getParkingSpotStatus,
  isReportVisible,
  loadReports,
  loadSettings,
  saveReports,
} from '../services/localStore';
import { api, apiAvailable, apiConfigured, normalizeFeed } from '../services/api';
import { clearPrivateSession, getPrivateSession, savePrivateSession } from '../services/secureStorage';
import { useAppModal } from '../components/AppModal';
import { getFastLocation } from '../services/locationService';
import { registerForPushNotifications } from '../services/pushNotifications';
import { canVerifyReport, VERIFICATION_RADIUS_METERS } from '../services/geo';
import { normalizeNotificationRadius } from '../services/notificationSettings';
import { getMapConfigurationError } from '../services/mapConfiguration';
import { reconcileParkingSession, resolveParkingSessionForEnd } from '../services/parkingSession';

const FALLBACK_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

const REPORT_FOCUS_TOP_HALF_OFFSET = 0.24;
const EVENT_REFRESH_INTERVAL_MS = 60_000;

const getReportPresentation = (report, theme) => {
  const meta = getReportMeta(report);
  const color = report.type === 'parking'
    ? theme.colors.success
    : report.type === 'chalking' ? theme.colors.secondaryDark : theme.colors.error;
  const backgroundColor = report.type === 'parking'
    ? theme.colors.successLight
    : report.type === 'chalking' ? theme.colors.secondaryLight : theme.colors.errorLight;
  return { ...meta, color, backgroundColor, label: report.type === 'parking' ? 'Open spot' : meta.shortLabel || meta.label };
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const getAddressWithTimeout = async (coords) => {
  try {
    const results = await Promise.race([
      Location.reverseGeocodeAsync(coords),
      wait(2500).then(() => []),
    ]);
    const address = results[0];
    if (!address) return 'Current location';
    return [address.street, address.city, address.region].filter(Boolean).join(', ') || 'Current location';
  } catch {
    return 'Current location';
  }
};

function ReportDetailCard({ report, location, onClose, onVerify, verificationMessage, now }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const meta = getReportPresentation(report, theme);
  const canVerify = canVerifyReport(location, report);
  const isStale = getParkingSpotStatus(report, now) === 'stale';
  const reportDistance = distanceMeters(location, report);

  return (
    <View accessibilityViewIsModal style={styles.reportDetailCard}>
      <View style={styles.reportDetailHeader}>
        <View style={styles.reportDetailTitleRow}>
          <View style={[styles.reportDetailIcon, { backgroundColor: meta.backgroundColor }]}>
            <Ionicons name={meta.icon} size={20} color={meta.color} />
          </View>
          <View style={styles.reportDetailTitleCopy}>
            <Text style={styles.reportDetailTitle}>{isStale ? 'Stale open spot' : meta.label}</Text>
            <Text style={styles.reportDetailAge}>{formatTimeAgo(report.createdAt)}{reportDistance === null ? '' : ` · ${reportDistance} m`}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close report details"
          onPress={onClose}
          style={styles.closeButton}
        >
          <View style={styles.closeButtonIcon}><Ionicons name="close" size={18} color={theme.colors.textSecondary} /></View>
        </Pressable>
      </View>

      <Text style={styles.reportDetailDescription} numberOfLines={2}>
        {report.address || meta.description}
      </Text>

      {isStale ? (
        <Text style={styles.verifyDisabled}>This spot has been open for over 5 minutes and may be taken.</Text>
      ) : canVerify ? (
        <>
          <Text style={styles.verifyPrompt}>Did you see this too?</Text>
          <View style={styles.verifyRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm report"
              style={[styles.verifyButton, styles.confirmButton]}
              onPress={() => onVerify('confirm')}
            >
              <Ionicons name="checkmark" size={17} color={theme.colors.white} />
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark report as not here"
              style={[styles.verifyButton, styles.denyButton]}
              onPress={() => onVerify('deny')}
            >
              <Ionicons name="close" size={17} color={theme.colors.text} />
              <Text style={styles.denyButtonText}>Not here</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.verifyDisabled}>Move within {VERIFICATION_RADIUS_METERS} m to verify this report.</Text>
      )}
      {verificationMessage ? <Text accessibilityLiveRegion="polite" style={styles.verificationMessage}>{verificationMessage}</Text> : null}
    </View>
  );
}

function MapStatusPill({ accessibilityLabel, icon, onPress, text, tone = 'default' }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const content = (
    <>
      <Ionicons name={icon} size={16} color={tone === 'warning' ? theme.colors.secondaryDark : theme.colors.primary} />
      <Text numberOfLines={1} style={[styles.statusText, tone === 'warning' && styles.statusTextWarning]}>{text}</Text>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || text}
        accessibilityLiveRegion="polite"
        onPress={onPress}
        style={({ pressed }) => [styles.statusPill, tone === 'warning' && styles.statusPillWarning, pressed && styles.statusPillPressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View accessible accessibilityLabel={accessibilityLabel || text} accessibilityLiveRegion="polite" style={[styles.statusPill, tone === 'warning' && styles.statusPillWarning]}>
      {content}
    </View>
  );
}

function NearbyReportsModal({ insets, localReports, location, now, onClose, onSelect, reports, selectedReportId, visible }) {
  const { theme, styles } = useThemedStyles(createStyles);
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.nearbyReportsBackdrop}>
        <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.nearbyReportsSheet, { marginBottom: insets.bottom + 8 }]}>
          <View style={styles.nearbyReportsHandle} />
          <View style={styles.nearbyReportsHeader}>
            <View>
              <Text accessibilityRole="header" style={styles.nearbyReportsSheetTitle}>{localReports ? 'Saved reports' : 'Nearby reports'}</Text>
              <Text style={styles.nearbyReportsSheetSubtitle}>{reports.length} {localReports ? 'saved on this device' : `community report${reports.length === 1 ? '' : 's'}`}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close nearby reports"
              onPress={onClose}
              style={styles.nearbyReportsCloseButton}
            >
              <View style={styles.closeButtonIcon}><Ionicons name="close" size={18} color={theme.colors.textSecondary} /></View>
            </Pressable>
          </View>

          <FlatList
            data={reports}
            keyExtractor={(item) => item.id}
            contentContainerStyle={reports.length ? styles.nearbyReportsList : styles.nearbyReportsEmptyList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={(
              <View style={styles.nearbyReportsEmpty}>
                <Ionicons name="map-outline" size={24} color={theme.colors.primaryDark} />
                <Text style={styles.nearbyReportsEmptyTitle}>{localReports ? 'No saved reports' : 'No nearby reports'}</Text>
                <Text style={styles.nearbyReportsEmptyText}>{localReports ? 'Reports saved on this device will appear here.' : 'New community signals will appear here.'}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const meta = getReportPresentation(item, theme);
              const isStale = getParkingSpotStatus(item, now) === 'stale';
              const isSelected = selectedReportId === item.id;
              const reportDistance = distanceMeters(location, item);
              const reportMeta = `${formatTimeAgo(item.createdAt)}${isStale ? ' · stale' : ''}${reportDistance === null ? '' : ` · ${reportDistance} m`}`;
              return (
                <Pressable
                  accessibilityRole="button"
                  testID={`nearby-report-row-${item.id}`}
                  accessibilityLabel={`${isStale ? 'Stale open spot' : meta.label}, ${reportMeta}`}
                  accessibilityHint="Centers the map on this report"
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [styles.nearbyReportRow, isSelected && styles.nearbyReportRowSelected, pressed && styles.nearbyReportRowPressed]}
                >
                  <View style={[styles.nearbyReportIcon, { backgroundColor: isStale ? theme.colors.surfaceSubtle : meta.backgroundColor }]}>
                    <Ionicons name={meta.icon} size={18} color={isStale ? theme.colors.textMuted : meta.color} />
                  </View>
                  <View style={styles.nearbyReportCopy}>
                    <Text numberOfLines={1} style={styles.nearbyReportTitle}>{isStale ? 'Stale open spot' : meta.label}</Text>
                    <Text numberOfLines={1} style={styles.nearbyReportMeta}>{reportMeta}</Text>
                  </View>
                  <Ionicons name="locate-outline" size={17} color={isSelected ? theme.colors.primary : theme.colors.textMuted} />
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function MapScreen(props) {
  const { styles } = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const error = getMapConfigurationError({
    platform: Platform.OS,
    executionEnvironment: Constants.executionEnvironment,
    androidMapsConfigured: Constants.expoConfig?.extra?.androidMapsConfigured,
  });
  if (error) {
    return (
      <View style={[styles.configurationError, { paddingTop: insets.top + 24 }]}>
        <Text accessibilityRole="header" style={styles.configurationErrorTitle}>Map configuration error</Text>
        <Text accessibilityLiveRegion="assertive" style={styles.configurationErrorMessage}>{error.message}</Text>
        <Text selectable style={styles.configurationErrorCode}>{error.code}</Text>
        <Button title="Go to Account" onPress={() => props.navigation.navigate('Account')} size="large" />
      </View>
    );
  }
  return <ReadyMapScreen {...props} />;
}

function ReadyMapScreen({ navigation }) {
  const { theme, styles } = useThemedStyles(createStyles);
  const mapRef = useRef(null);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [bottomCardLayout, setBottomCardLayout] = useState({ height: 80, reportId: null });
  const [topOverlayHeight, setTopOverlayHeight] = useState(0);
  const mapStyle = useMemo(() => theme.dark ? [
    { elementType: 'geometry', stylers: [{ color: theme.colors.mapBackground }] },
    { elementType: 'labels.text.fill', stylers: [{ color: theme.colors.textSecondary }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: theme.colors.mapBackground }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: theme.colors.surfaceDark }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: theme.colors.primaryLight }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: theme.colors.successLight }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  ] : [], [theme]);
  const { showModal } = useAppModal();
  const isFocused = useIsFocused();
  const [location, setLocation] = useState(null);
  const [locationUpdatedAt, setLocationUpdatedAt] = useState(0);
  const [locationError, setLocationError] = useState('');
  const [locationLoading, setLocationLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [parkingSession, setParkingSession] = useState(null);
  const [isParking, setIsParking] = useState(false);
  const [isUnparking, setIsUnparking] = useState(false);
  const [alertsReady, setAlertsReady] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [pendingReportFocus, setPendingReportFocus] = useState(null);
  const [reportsModalVisible, setReportsModalVisible] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [syncError, setSyncError] = useState(() => (
    apiConfigured ? '' : 'Offline guest mode: live reports are unavailable.'
  ));
  const [latestNotification, setLatestNotification] = useState(null);
  const [sessionNotice, setSessionNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const sessionSyncRef = useRef(null);
  const activeSessionRef = useRef(null);
  const sessionHydratedRef = useRef(false);
  const finishingSessionRef = useRef(false);
  const currentRegionRef = useRef(FALLBACK_REGION);

  useEffect(() => {
    if (!isFocused || !selectedReportId) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedReportId(null);
      return true;
    });
    return () => subscription.remove();
  }, [isFocused, selectedReportId]);

  const refreshLocation = useCallback(async (showError = false) => {
    setLocationLoading(true);
    try {
      const position = await getFastLocation({ allowStaleFallback: true });
      const nextLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      setLocation(nextLocation);
      setLocationUpdatedAt(Date.now());
      setLocationError('');
      mapRef.current?.animateToRegion({ ...nextLocation, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 700);
    } catch (error) {
      setLocationError(error.message || 'Could not get your current location.');
      if (showError) showModal('Location unavailable', error.message || 'Try again after checking location settings.');
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLocation(false);
  }, [refreshLocation]);

  useEffect(() => {
    if (!isFocused) return undefined;
    let mounted = true;
    let refreshing = false;

    const refreshEvents = () => {
      if (!mounted || refreshing || (AppState.currentState && AppState.currentState !== 'active')) return;
      refreshing = true;

      return Promise.all([
        loadSettings(),
        apiAvailable() ? api.preferences().then((remote) => ({
          notificationsEnabled: remote.notifications_enabled,
          notificationRadiusMeters: normalizeNotificationRadius(remote.notification_radius_meters),
          askAboutEnforcementAfterParking: remote.ask_about_enforcement_after_parking,
          announceOpenSpotAfterUnparking: remote.announce_open_spot_after_unparking,
        })).catch(() => null) : Promise.resolve(null),
        apiAvailable() && location ? api.nearby(location.latitude, location.longitude, settings.notificationRadiusMeters).then(normalizeFeed) : loadReports(),
        getPrivateSession(),
        apiAvailable() ? api.activeSession().catch(() => null) : Promise.resolve(null),
        apiAvailable() ? api.notifications().catch(() => null) : Promise.resolve(null),
      ]).then(([localSettings, remoteSettings, storedReports, storedSession, remoteSessionState, notificationResponse]) => {
        if (!mounted) return;
        setSettings(remoteSettings || localSettings);
        setReports(storedReports);
        const hydratedSession = reconcileParkingSession(storedSession, remoteSessionState);
        if (!finishingSessionRef.current && (!sessionHydratedRef.current || activeSessionRef.current !== hydratedSession?.id)) {
          setParkingSession(hydratedSession);
          activeSessionRef.current = hydratedSession?.id || null;
          sessionHydratedRef.current = true;
          if (storedSession?.id !== hydratedSession?.id) {
            if (hydratedSession) savePrivateSession(hydratedSession).catch(() => {});
            else if (storedSession) clearPrivateSession().catch(() => {});
          }
        }
        setLatestNotification(notificationResponse?.notifications?.find((item) => (item.read_at === null || item.read_at === undefined) && item.status !== 'read') || null);
        setSyncError(apiAvailable() ? '' : (apiConfigured
          ? 'Guest mode: live reports are unavailable.'
          : 'Offline guest mode: live reports are unavailable.'));
      }).catch((error) => {
        if (mounted) {
          setSyncError(apiConfigured ? (error.message || 'Live reports are unavailable.') : 'Offline guest mode: live reports are unavailable.');
        }
      }).finally(() => {
        refreshing = false;
      });
    };

    refreshEvents();
    const timer = setInterval(refreshEvents, EVENT_REFRESH_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshEvents();
    });

    return () => {
      mounted = false;
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [isFocused, location, settings.notificationRadiusMeters]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const visibleReports = useMemo(() => reports.filter((report) => isReportVisible(report, now)), [now, reports]);
  const selectedReport = visibleReports.find((report) => report.id === selectedReportId) || null;
  const localReports = !apiAvailable() || Boolean(syncError);
  const reportSummary = useMemo(() => {
    const enforcement = visibleReports.filter((report) => report.type !== 'parking').length;
    const parking = visibleReports.length - enforcement;
    return [enforcement ? `${enforcement} enforcement` : null, parking ? `${parking} open spot${parking === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');
  }, [visibleReports]);

  const enableParkingAlerts = useCallback(async () => {
    if (!settings.notificationsEnabled || !apiAvailable()) {
      setAlertsReady(false);
      return;
    }

    try {
      const pushToken = await registerForPushNotifications();
      if (!pushToken) {
        setAlertsReady(false);
        return;
      }
      await api.updatePushToken(pushToken);
      setAlertsReady(true);
    } catch {
      // Permission and token failures must not interrupt the parking flow.
      setAlertsReady(false);
    }
  }, [settings.notificationsEnabled]);

  useEffect(() => {
    if (!parkingSession) {
      setAlertsReady(false);
      return;
    }
    enableParkingAlerts();
  }, [enableParkingAlerts, parkingSession?.id]);

  const handleParkHere = async () => {
    setIsParking(true);
    try {
      const position = location && Date.now() - locationUpdatedAt <= 60 * 1000
        ? { coords: location, source: 'screen-cache' }
        : await getFastLocation({ allowStaleFallback: true });
      const { latitude, longitude, accuracy } = position.coords;
      const localSession = {
        id: String(Date.now()),
        latitude,
        longitude,
        accuracy,
        address: 'Current location',
        startedAt: new Date().toISOString(),
        nearbyEnforcement: null,
      };

      await savePrivateSession(localSession);
      setParkingSession(localSession);
      activeSessionRef.current = localSession.id;
      sessionHydratedRef.current = true;
      if (apiAvailable()) {
        sessionSyncRef.current = api.startSession({ latitude, longitude, address: localSession.address })
          .then((remote) => {
            const syncedSession = { ...localSession, id: remote.id, startedAt: remote.started_at };
            if (activeSessionRef.current === localSession.id) {
              setParkingSession((current) => (current?.id === localSession.id ? syncedSession : current));
              savePrivateSession(syncedSession)
                .then(async () => {
                  if (activeSessionRef.current !== localSession.id) {
                    const storedAfterSync = await getPrivateSession();
                    if (storedAfterSync?.id === syncedSession.id) await clearPrivateSession();
                  }
                })
                .catch(() => {});
              setSyncError('');
            }
            return syncedSession;
          })
          .catch((error) => {
            if (activeSessionRef.current === localSession.id) {
              setSyncError('Parking protection is saved locally but could not sync.');
              showModal('Could not sync parking protection', error.message || 'Your location is saved locally. Please try again when connected.');
            }
            return null;
          });
      }
      getAddressWithTimeout({ latitude, longitude }).then(async (address) => {
        if (activeSessionRef.current !== localSession.id) return;
        const currentSession = await getPrivateSession();
        if (!currentSession || activeSessionRef.current !== localSession.id) return;
        const nextSession = currentSession?.id ? { ...currentSession, address } : { ...localSession, address };
        setParkingSession((current) => (
          activeSessionRef.current === localSession.id && (current?.id === localSession.id || current?.id?.includes('-'))
            ? { ...current, address }
            : current
        ));
        await savePrivateSession(nextSession);
        if (activeSessionRef.current !== localSession.id) {
          const storedAfterAddress = await getPrivateSession();
          if (storedAfterAddress?.id === nextSession.id) await clearPrivateSession();
        }
      }).catch(() => {});
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 700);

      if (position.source === 'stale-fallback') {
        showModal(
          'Using your recent location',
          'A fresh GPS fix is taking longer than usual, so protection started with your most recent location.',
        );
      }
    } catch (error) {
      showModal('Could not mark your car', error.message || 'Try again after checking your location settings.');
    } finally {
      setIsParking(false);
    }
  };

  const finishSession = async (session, shareOpenSpot) => {
    if (!session || finishingSessionRef.current) return;
    finishingSessionRef.current = true;
    setIsUnparking(true);
    activeSessionRef.current = null;
    try {
      let apiSession = session;
      if (apiAvailable() && !apiSession.id?.includes('-')) {
        if (sessionSyncRef.current) {
          apiSession = await sessionSyncRef.current || apiSession;
        }
        // After an offline start, create the missing server session on recovery
        // so an open spot is actually shared when the driver taps Unpark.
        apiSession = await resolveParkingSessionForEnd(apiSession, shareOpenSpot, api);
      }
      if (apiAvailable() && apiSession.id?.includes('-')) {
        await api.endSession(apiSession.id, shareOpenSpot);
        if (location) {
          api.nearby(location.latitude, location.longitude, settings.notificationRadiusMeters)
            .then((refreshed) => setReports(normalizeFeed(refreshed)))
            .catch(() => {});
        }
      }
      await clearPrivateSession();
      setParkingSession(null);
      sessionSyncRef.current = null;
      if (shareOpenSpot && !apiAvailable()) {
        const createdAt = new Date().toISOString();
        const openSpot = {
          id: `open-spot-${Date.now()}`,
          type: 'parking',
          latitude: Number(session.latitude.toFixed(4)),
          longitude: Number(session.longitude.toFixed(4)),
          address: session.address || 'Spot just opened',
          createdAt,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          baseConfidence: 0.72,
          confidence: 0.72,
          confirmations: 0,
          disputes: 0,
          source: 'you',
          active: true,
        };
        const nextReports = await appendReport(openSpot);
        setReports(nextReports);
      }
      if (shareOpenSpot) {
        setSessionNotice(apiAvailable() ? 'Open spot shared for 15 min' : 'Open spot saved on this device');
        setTimeout(() => setSessionNotice(''), 3500);
      }
    } catch (error) {
      activeSessionRef.current = session.id;
      showModal('Could not finish parking session', error.message || 'Please try again.');
    } finally {
      finishingSessionRef.current = false;
      setIsUnparking(false);
    }
  };

  const handleUnpark = () => finishSession(parkingSession, settings.announceOpenSpotAfterUnparking);

  const acknowledgeNotification = async () => {
    const notification = latestNotification;
    setLatestNotification(null);
    if (notification?.id && apiAvailable()) {
      await api.markNotificationRead(notification.id).catch(() => {});
    }
  };

  const handleVerify = async (vote) => {
    if (!canVerifyReport(location, selectedReport)) return;
    if (apiAvailable() && selectedReport?.id && selectedReport.id.includes('-') && location) {
      try {
        await api.verifyReport(selectedReport.type, selectedReport.id, {
          verification_type: vote,
          latitude: location.latitude,
          longitude: location.longitude,
        });
        const refreshed = await api.nearby(location.latitude, location.longitude, settings.notificationRadiusMeters);
        setReports(normalizeFeed(refreshed));
        setVerificationMessage(vote === 'confirm' ? 'Thanks — your confirmation raised this report’s confidence.' : 'Thanks — we’ll lower confidence for this report.');
        return;
      } catch (error) {
        setVerificationMessage(error.message || 'Could not save verification.');
        return;
      }
    }
    const nextReports = applyVerification(reports, selectedReport.id, vote);
    await saveReports(nextReports);
    setReports(nextReports);
    setVerificationMessage(vote === 'confirm' ? 'Thanks — your confirmation raised this report’s confidence.' : 'Thanks — we’ll lower confidence for this report.');
    setTimeout(() => setVerificationMessage(''), 3500);
  };

  const focusReportOnMap = useCallback((report) => {
    setSelectedReportId(report.id);
    setVerificationMessage('');
    setPendingReportFocus(report);
    setReportsModalVisible(false);
  }, []);

  useEffect(() => {
    if (!pendingReportFocus) return undefined;
    if (selectedReport?.id !== pendingReportFocus.id) {
      setPendingReportFocus(null);
      return undefined;
    }
    if (reportsModalVisible
      || bottomCardLayout.reportId !== pendingReportFocus.id
      || bottomCardLayout.height <= 0) return undefined;

    // Changing native map padding moves the camera and cancels its animation.
    // Wait for the selected card's measured padding to commit before focusing.
    const frame = requestAnimationFrame(() => {
      const currentRegion = currentRegionRef.current || FALLBACK_REGION;
      const latitudeOffset = Platform.OS === 'android' ? 0 : currentRegion.latitudeDelta * REPORT_FOCUS_TOP_HALF_OFFSET;
      mapRef.current?.animateCamera({
        center: { latitude: pendingReportFocus.latitude - latitudeOffset, longitude: pendingReportFocus.longitude },
      }, { duration: 450 });
      setPendingReportFocus(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [bottomCardLayout, pendingReportFocus, reportsModalVisible, selectedReport]);

  const parkedMinutes = parkingSession
    ? Math.max(0, Math.floor((now - new Date(parkingSession.startedAt).getTime()) / 60000))
    : 0;
  const parkingActionTitle = parkingSession
    ? (settings.announceOpenSpotAfterUnparking ? 'Unpark & share' : 'Unpark')
    : 'Park here';
  const notificationTitle = latestNotification?.title || 'Parking alert';
  const notificationSummary = [notificationTitle, latestNotification?.body].filter(Boolean).join(' · ');
  const status = locationError
    ? {
        accessibilityLabel: 'Location unavailable. Double tap to retry.',
        icon: 'locate-outline',
        onPress: () => refreshLocation(true),
        text: 'Location unavailable · Retry',
        tone: 'warning',
      }
      : latestNotification
        ? {
          accessibilityLabel: `${notificationSummary}. Double tap to dismiss.`,
          icon: 'notifications-outline',
          onPress: acknowledgeNotification,
          text: notificationSummary,
        }
      : sessionNotice
        ? { icon: 'checkmark-circle-outline', text: sessionNotice }
      : parkingSession
        ? {
            icon: 'shield-checkmark-outline',
            text: !apiAvailable() || syncError
              ? 'Parked · saved locally'
              : !settings.notificationsEnabled
                ? 'Alerts off'
                : alertsReady
                ? 'Alerts on'
                : 'Alerts unavailable',
          }
        : locationLoading
          ? { icon: 'locate-outline', text: 'Finding your location…' }
        : syncError
          ? { icon: 'cloud-offline-outline', text: apiAvailable() ? 'Offline · saved reports' : 'Guest · saved on this device', tone: 'warning' }
          : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={FALLBACK_REGION}
        userInterfaceStyle={theme.dark ? 'dark' : 'light'}
        customMapStyle={Platform.OS === 'android' ? mapStyle : undefined}
        mapPadding={{ top: insets.top + 15 + topOverlayHeight + 12, right: 10, bottom: tabBarHeight + bottomCardLayout.height + 24, left: 10 }}
        onRegionChangeComplete={(region) => { currentRegionRef.current = region; }}
        showsUserLocation={Boolean(location)}
        showsMyLocationButton
        showsCompass
        onPress={() => setSelectedReportId(null)}
      >
        {visibleReports.map((report) => {
          const isStale = getParkingSpotStatus(report, now) === 'stale';
          const isSelected = selectedReportId === report.id;
          return (
            <ReportMarker
              key={report.id}
              report={report}
              isStale={isStale}
              isSelected={isSelected}
              onPress={() => setSelectedReportId(report.id)}
            />
          );
        })}
      </MapView>

      <View
        onLayout={({ nativeEvent }) => setTopOverlayHeight(nativeEvent.layout.height)}
        style={[styles.topOverlay, { top: insets.top + 15 }]}
      >
        {status ? <MapStatusPill {...status} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${visibleReports.length} ${localReports ? 'saved' : 'nearby'} reports`}
          accessibilityHint="Opens the nearby reports sheet"
          onPress={() => {
            setSelectedReportId(null);
            setReportsModalVisible(true);
          }}
          style={({ pressed }) => [styles.nearbyReportsCard, pressed && styles.nearbyReportsCardPressed]}
        >
          <View style={styles.nearbyReportsIcon}>
            <Ionicons name="layers-outline" size={18} color={theme.colors.primaryDark} />
          </View>
          <View style={styles.nearbyReportsCopy}>
            <Text numberOfLines={1} style={styles.nearbyReportsTitle}>
              {visibleReports.length} {localReports ? 'saved' : 'nearby'} report{visibleReports.length === 1 ? '' : 's'}
            </Text>
            <Text numberOfLines={1} style={styles.nearbyReportsSubtitle}>
              {localReports ? 'Saved on this device' : reportSummary || 'No community reports nearby'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {/* Keep actions and native map attribution above the floating tabs. */}
      <View
        key={`${selectedReport?.id || 'parking'}-${reportsModalVisible ? 'hidden' : 'shown'}`}
        onLayout={({ nativeEvent }) => setBottomCardLayout({
          height: nativeEvent.layout.height,
          reportId: selectedReport && !reportsModalVisible ? selectedReport.id : null,
        })}
        style={[styles.bottomOverlay, { bottom: tabBarHeight + 10 }]}
      >
        {selectedReport && !reportsModalVisible ? (
          <ReportDetailCard
            report={selectedReport}
            location={location}
            now={now}
            onClose={() => setSelectedReportId(null)}
            onVerify={handleVerify}
            verificationMessage={verificationMessage}
          />
        ) : null}

        {!selectedReport ? (
          <View style={styles.parkingSheet}>
            {parkingSession ? <Text style={styles.parkingSheetTitle}>Parked · {parkedMinutes} min</Text> : null}
            <View style={styles.parkingActionRow}>
              <Button
                title={parkingActionTitle}
                onPress={parkingSession ? handleUnpark : handleParkHere}
                variant="primary"
                size="medium"
                loading={isParking || isUnparking}
                icon={<Ionicons name={parkingSession ? 'car-outline' : 'location-outline'} size={19} color={theme.colors.white} />}
                style={styles.parkButton}
                textStyle={styles.parkButtonText}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Report enforcement activity"
                accessibilityHint="Opens the parking enforcement signal form"
                onPress={() => navigation.navigate('ReportEnforcement', {
                  location: location && Date.now() - locationUpdatedAt <= 60 * 1000 ? location : null,
                })}
                style={({ pressed }) => [styles.reportActionButton, pressed && styles.reportActionButtonPressed]}
              >
                <Ionicons name="flag-outline" size={18} color={theme.colors.text} />
                <Text style={styles.reportActionText}>Report</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
      <NearbyReportsModal
        insets={insets}
        localReports={localReports}
        location={location}
        now={now}
        onClose={() => setReportsModalVisible(false)}
        onSelect={focusReportOnMap}
        reports={visibleReports}
        selectedReportId={selectedReportId}
        visible={reportsModalVisible}
      />
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  configurationError: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 24, justifyContent: 'center' },
  configurationErrorTitle: { fontSize: 22, fontWeight: '600', color: theme.colors.text, marginBottom: 12 },
  configurationErrorMessage: { fontSize: 16, lineHeight: 24, color: theme.colors.textSecondary, marginBottom: 12 },
  configurationErrorCode: { fontSize: 12, color: theme.colors.error, marginBottom: 24 },
  container: { flex: 1, backgroundColor: theme.colors.mapBackground },
  map: { flex: 1 },
  topOverlay: { alignItems: 'center', gap: 10, left: theme.spacing.md, position: 'absolute', right: theme.spacing.md },
  statusPill: {
    alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 24,
    flexDirection: 'row', maxWidth: '100%', minHeight: 44, paddingHorizontal: 13,
    paddingVertical: 8, ...theme.shadows.small,
  },
  statusPillWarning: { backgroundColor: theme.colors.warningLight },
  statusText: { color: theme.colors.text, flexShrink: 1, fontSize: 12, fontWeight: '500', marginLeft: 6 },
  statusTextWarning: { color: theme.colors.secondaryDark },
  statusPillPressed: { opacity: 0.8 },
  nearbyReportsCard: {
    alignItems: 'center', alignSelf: 'center', backgroundColor: theme.colors.surface,
    borderRadius: 19, flexDirection: 'row', maxWidth: '100%', minHeight: 62,
    paddingHorizontal: 13, paddingVertical: 11, width: 246, ...theme.shadows.medium,
  },
  nearbyReportsCardPressed: { opacity: 0.75 },
  nearbyReportsIcon: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  nearbyReportsCopy: { flex: 1, marginHorizontal: 9 },
  nearbyReportsTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '600' },
  nearbyReportsSubtitle: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 3 },
  nearbyReportsBackdrop: { backgroundColor: theme.colors.backdrop, flex: 1, justifyContent: 'flex-end' },
  nearbyReportsSheet: {
    backgroundColor: theme.colors.surface, borderRadius: 30, height: '52%',
    marginHorizontal: 9, maxHeight: 440, minHeight: 300, paddingHorizontal: 18,
    paddingTop: 10, paddingBottom: 18, ...theme.shadows.large,
  },
  nearbyReportsHandle: { alignSelf: 'center', backgroundColor: theme.colors.border.medium, borderRadius: 2, height: 4, marginBottom: 10, width: 32 },
  nearbyReportsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  nearbyReportsSheetTitle: { color: theme.colors.text, fontSize: 21, fontWeight: '600', lineHeight: 27 },
  nearbyReportsSheetSubtitle: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
  nearbyReportsCloseButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', marginLeft: theme.spacing.sm, width: 44 },
  nearbyReportsList: { paddingBottom: theme.spacing.xs },
  nearbyReportsEmptyList: { flexGrow: 1, justifyContent: 'center' },
  nearbyReportsEmpty: { alignItems: 'center', padding: theme.spacing.md },
  nearbyReportsEmptyTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600', marginTop: 8 },
  nearbyReportsEmptyText: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'center' },
  nearbyReportRow: { alignItems: 'center', borderBottomColor: theme.colors.border.light, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', minHeight: 74, paddingVertical: 12 },
  nearbyReportRowSelected: { backgroundColor: theme.colors.primaryLight, borderRadius: 14, borderBottomWidth: 0, marginVertical: 2, paddingHorizontal: theme.spacing.sm },
  nearbyReportRowPressed: { opacity: 0.7 },
  nearbyReportIcon: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  nearbyReportCopy: { flex: 1, marginHorizontal: 12 },
  nearbyReportTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '600' },
  nearbyReportMeta: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 4 },
  bottomOverlay: { left: 14, position: 'absolute', right: 14 },
  reportDetailCard: { backgroundColor: theme.colors.surface, borderRadius: 25, padding: 15, ...theme.shadows.large },
  reportDetailHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  reportDetailTitleRow: { alignItems: 'center', flexDirection: 'row', flex: 1 },
  reportDetailIcon: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  reportDetailTitleCopy: { flex: 1, marginLeft: 10 },
  reportDetailTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '600' },
  reportDetailAge: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 3 },
  closeButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', marginLeft: theme.spacing.sm, width: 44 },
  closeButtonIcon: { alignItems: 'center', backgroundColor: theme.colors.surfaceSubtle, borderRadius: 14, height: 28, justifyContent: 'center', width: 28 },
  reportDetailDescription: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  verifyPrompt: { color: theme.colors.text, fontSize: 13, fontWeight: '500', marginTop: 12 },
  verifyRow: { flexDirection: 'row', gap: 8, marginTop: 9 },
  verifyButton: { alignItems: 'center', borderRadius: 15, flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', minHeight: 46, paddingHorizontal: 6, paddingVertical: 10 },
  confirmButton: { backgroundColor: theme.colors.primary },
  denyButton: { backgroundColor: theme.colors.surfaceSubtle },
  confirmButtonText: { color: theme.colors.white, fontSize: 13, fontWeight: '600' },
  denyButtonText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  verifyDisabled: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 10 },
  verificationMessage: { color: theme.colors.primaryDark, fontSize: 12, fontWeight: '500', lineHeight: 18, marginTop: 10 },
  parkingSheet: { backgroundColor: theme.colors.surface, borderRadius: 23, padding: 10, ...theme.shadows.large },
  parkingSheetTitle: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 10, marginLeft: 4, marginTop: 2 },
  parkingActionRow: { flexDirection: 'row', gap: 8 },
  parkButton: { borderRadius: 16, flex: 1, minHeight: 50, paddingHorizontal: 10 },
  parkButtonText: { fontSize: 15, fontWeight: '600' },
  reportActionButton: { alignItems: 'center', backgroundColor: theme.colors.surfaceSubtle, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', minHeight: 50, paddingHorizontal: 14 },
  reportActionText: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginLeft: 6 },
  reportActionButtonPressed: { opacity: 0.7 },
});
