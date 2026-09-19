import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components';
import { theme } from '../theme';
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

const FALLBACK_REGION = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

const REPORT_FOCUS_TOP_HALF_OFFSET = 0.24;

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

function ReportDetailCard({ report, location, notificationRadius, onClose, onVerify, verificationMessage, now }) {
  const meta = getReportMeta(report);
  const reportDistance = distanceMeters(location, report);
  const canVerify = reportDistance === null || reportDistance <= notificationRadius;
  const isStale = getParkingSpotStatus(report, now) === 'stale';

  return (
    <View accessibilityViewIsModal style={styles.reportDetailCard}>
      <View style={styles.reportDetailHeader}>
        <View style={styles.reportDetailTitleRow}>
          <View style={[styles.reportDetailIcon, { backgroundColor: `${meta.color}20` }]}>
            <Ionicons name={meta.icon} size={20} color={meta.color} />
          </View>
          <View style={styles.reportDetailTitleCopy}>
            <Text style={styles.reportDetailTitle}>{isStale ? 'Stale open spot' : meta.label}</Text>
            <Text style={styles.reportDetailAge}>{formatTimeAgo(report.createdAt)}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close report details"
          onPress={onClose}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
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
              <Text style={styles.confirmButtonText}>✓ Confirm</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark report as not here"
              style={[styles.verifyButton, styles.denyButton]}
              onPress={() => onVerify('deny')}
            >
              <Text style={styles.denyButtonText}>✕ Not here</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.verifyDisabled}>Move within {notificationRadius} m to verify this report.</Text>
      )}
      {verificationMessage ? <Text accessibilityLiveRegion="polite" style={styles.verificationMessage}>{verificationMessage}</Text> : null}
    </View>
  );
}

function MapStatusPill({ accessibilityLabel, icon, onPress, text, tone = 'default' }) {
  const content = (
    <>
      <Ionicons name={icon} size={16} color={tone === 'warning' ? theme.colors.warning : theme.colors.primary} />
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

function NearbyReportsModal({ insets, location, now, onClose, onSelect, reports, selectedReportId, visible }) {
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
              <Text style={styles.nearbyReportsSheetTitle}>Nearby reports · {reports.length}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close nearby reports"
              onPress={onClose}
              style={styles.nearbyReportsCloseButton}
            >
              <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <FlatList
            data={reports}
            keyExtractor={(item) => item.id}
            contentContainerStyle={reports.length ? styles.nearbyReportsList : styles.nearbyReportsEmptyList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={(
              <View style={styles.nearbyReportsEmpty}>
                <Ionicons name="map-outline" size={24} color={theme.colors.primary} />
                <Text style={styles.nearbyReportsEmptyTitle}>No nearby reports</Text>
                <Text style={styles.nearbyReportsEmptyText}>New community signals will appear here.</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const meta = getReportMeta(item);
              const isStale = getParkingSpotStatus(item, now) === 'stale';
              const isSelected = selectedReportId === item.id;
              const reportDistance = distanceMeters(location, item);
              const reportMeta = `${formatTimeAgo(item.createdAt)}${isStale ? ' · stale' : ''}${reportDistance === null ? '' : ` · ${reportDistance} m`}`;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${isStale ? 'Stale open spot' : meta.label}, ${reportMeta}`}
                  accessibilityHint="Centers the map on this report"
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [styles.nearbyReportRow, isSelected && styles.nearbyReportRowSelected, pressed && styles.nearbyReportRowPressed]}
                >
                  <View style={[styles.nearbyReportIcon, { backgroundColor: isStale ? '#E2E8F0' : `${meta.color}20` }]}>
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

export default function MapScreen({ navigation }) {
  const mapRef = useRef(null);
  const insets = useSafeAreaInsets();
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

    Promise.all([
      loadSettings(),
      apiAvailable() ? api.preferences().then((remote) => ({
        notificationsEnabled: remote.notifications_enabled,
        notificationRadiusMeters: remote.notification_radius_meters,
        askAboutEnforcementAfterParking: remote.ask_about_enforcement_after_parking,
        announceOpenSpotAfterUnparking: remote.announce_open_spot_after_unparking,
      })).catch(() => null) : Promise.resolve(null),
      apiAvailable() && location ? api.nearby(location.latitude, location.longitude, settings.notificationRadiusMeters).then(normalizeFeed) : loadReports(),
      getPrivateSession(),
      apiAvailable() ? api.notifications().catch(() => null) : Promise.resolve(null),
    ]).then(([localSettings, remoteSettings, storedReports, storedSession, notificationResponse]) => {
      if (!mounted) return;
      setSettings(remoteSettings || localSettings);
      setReports(storedReports);
      if (!sessionHydratedRef.current) {
        const hydratedSession = storedSession || null;
        setParkingSession(hydratedSession);
        activeSessionRef.current = hydratedSession?.id || null;
        sessionHydratedRef.current = true;
      }
      setLatestNotification(notificationResponse?.notifications?.find((item) => (item.read_at === null || item.read_at === undefined) && item.status !== 'read') || null);
      setSyncError(apiAvailable() ? '' : (apiConfigured
        ? 'Guest mode: live reports are unavailable.'
        : 'Offline guest mode: live reports are unavailable.'));
    }).catch((error) => {
      if (mounted) {
        setSyncError(apiConfigured ? (error.message || 'Live reports are unavailable.') : 'Offline guest mode: live reports are unavailable.');
      }
    });

    return () => {
      mounted = false;
    };
  }, [isFocused, location]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const visibleReports = useMemo(() => reports.filter((report) => isReportVisible(report, now)), [now, reports]);
  const selectedReport = visibleReports.find((report) => report.id === selectedReportId) || null;

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
      if (apiAvailable() && !apiSession.id?.includes('-') && sessionSyncRef.current) {
        apiSession = await sessionSyncRef.current || apiSession;
      }
      if (apiAvailable() && apiSession.id?.includes('-')) {
        await api.endSession(apiSession.id, shareOpenSpot);
        if (location) {
          const refreshed = await api.nearby(location.latitude, location.longitude, settings.notificationRadiusMeters);
          setReports(normalizeFeed(refreshed));
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
        setSessionNotice('Open spot shared for 15 min');
        setTimeout(() => setSessionNotice(''), 3500);
      }
    } catch (error) {
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
    const currentRegion = currentRegionRef.current || FALLBACK_REGION;
    setSelectedReportId(report.id);
    setVerificationMessage('');
    // The reports sheet occupies the lower half of the screen, so the map
    // center is shifted south to keep the selected marker in the visible top half.
    mapRef.current?.animateToRegion({
      latitude: report.latitude - currentRegion.latitudeDelta * REPORT_FOCUS_TOP_HALF_OFFSET,
      longitude: report.longitude,
      latitudeDelta: currentRegion.latitudeDelta,
      longitudeDelta: currentRegion.longitudeDelta,
    }, 450);
    setReportsModalVisible(false);
  }, []);

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
                ? 'Parked · alerts off'
                : alertsReady
                ? 'Parked · alerts on'
                : 'Parked · protection active',
          }
        : locationLoading
          ? { icon: 'locate-outline', text: 'Finding your location…' }
        : syncError
          ? { icon: 'cloud-offline-outline', text: 'Offline · reports saved locally', tone: 'warning' }
          : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={FALLBACK_REGION}
        onRegionChangeComplete={(region) => { currentRegionRef.current = region; }}
        showsUserLocation={Boolean(location)}
        showsMyLocationButton
        showsCompass
        onPress={() => setSelectedReportId(null)}
      >
        {visibleReports.map((report) => {
          const meta = getReportMeta(report);
          const isStale = getParkingSpotStatus(report, now) === 'stale';
          const isSelected = selectedReportId === report.id;
          return (
            <Marker
              key={report.id}
              coordinate={{ latitude: report.latitude, longitude: report.longitude }}
              onPress={() => setSelectedReportId(report.id)}
              tracksViewChanges={false}
              accessible
              accessibilityLabel={`${isStale ? 'Stale open spot' : meta.label}, ${formatTimeAgo(report.createdAt)}. Double tap for details.`}
              accessibilityHint="Opens report details and verification options"
            >
              <View
                style={[styles.marker, { backgroundColor: isStale ? '#94A3B8' : meta.color }, isSelected && styles.markerSelected]}
              >
                <Ionicons name={meta.icon} size={16} color={theme.colors.white} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={[styles.topOverlay, { top: insets.top + 10 }]}>
        {status ? <MapStatusPill {...status} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${visibleReports.length} nearby reports`}
          accessibilityHint="Opens the nearby reports sheet"
          onPress={() => {
            setSelectedReportId(null);
            setReportsModalVisible(true);
          }}
          style={({ pressed }) => [styles.nearbyReportsCard, pressed && styles.nearbyReportsCardPressed]}
        >
          <View style={styles.nearbyReportsIcon}>
            <Ionicons name="pulse-outline" size={17} color={theme.colors.primary} />
          </View>
          <View style={styles.nearbyReportsCopy}>
            <Text numberOfLines={1} style={styles.nearbyReportsTitle}>
              {visibleReports.length} nearby report{visibleReports.length === 1 ? '' : 's'}
            </Text>
            <Text numberOfLines={1} style={styles.nearbyReportsSubtitle}>
              {visibleReports.length ? 'Review community signals' : 'Nothing to review right now'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {/* The bottom-tab navigator already reserves the Android safe area. */}
      <View style={[styles.bottomOverlay, { bottom: 8 }]}>
        {selectedReport && !reportsModalVisible ? (
          <ReportDetailCard
            report={selectedReport}
            location={location}
            notificationRadius={settings.notificationRadiusMeters}
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
                <Ionicons name="radio-outline" size={16} color={theme.colors.primaryDark} />
                <Text style={styles.reportActionText}>Report</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
      <NearbyReportsModal
        insets={insets}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#DCE9F5' },
  map: { flex: 1 },
  topOverlay: {
    alignItems: 'center',
    left: theme.spacing.lg,
    position: 'absolute',
    right: theme.spacing.lg,
  },
  statusPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: theme.colors.border.light,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 4,
    flexDirection: 'row',
    maxWidth: '100%',
    minHeight: 44,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  statusPillWarning: { backgroundColor: '#FFF9ED', borderColor: '#F2C66D' },
  statusText: { color: theme.colors.text, flexShrink: 1, fontSize: 12, fontWeight: '800', marginLeft: 6 },
  statusTextWarning: { color: '#8A5A00' },
  statusPillPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  nearbyReportsCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: theme.colors.border.light,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 2,
    maxWidth: 248,
    minHeight: 48,
    paddingHorizontal: theme.spacing.sm,
    ...theme.shadows.small,
  },
  nearbyReportsCardPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  nearbyReportsIcon: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 9, height: 30, justifyContent: 'center', width: 30 },
  nearbyReportsCopy: { flex: 1, marginHorizontal: 6 },
  nearbyReportsTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  nearbyReportsSubtitle: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 2 },
  nearbyReportsBackdrop: { backgroundColor: 'rgba(18,35,45,0.10)', flex: 1, justifyContent: 'flex-end' },
  nearbyReportsSheet: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border.light,
    borderRadius: 20,
    borderWidth: 1,
    height: '52%',
    marginHorizontal: theme.spacing.md,
    maxHeight: 440,
    minHeight: 260,
    padding: 12,
    ...theme.shadows.large,
  },
  nearbyReportsHandle: { alignSelf: 'center', backgroundColor: theme.colors.border.medium, borderRadius: 2, height: 4, marginBottom: 6, width: 28 },
  nearbyReportsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  nearbyReportsSheetTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800' },
  nearbyReportsCloseButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', marginLeft: theme.spacing.sm, width: 44 },
  nearbyReportsList: { paddingBottom: theme.spacing.xs },
  nearbyReportsEmptyList: { flexGrow: 1, justifyContent: 'center' },
  nearbyReportsEmpty: { alignItems: 'center', padding: theme.spacing.md },
  nearbyReportsEmptyTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '800', marginTop: 6 },
  nearbyReportsEmptyText: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2, textAlign: 'center' },
  nearbyReportRow: { alignItems: 'center', borderBottomColor: theme.colors.border.light, borderBottomWidth: 1, flexDirection: 'row', minHeight: 56, paddingVertical: 6 },
  nearbyReportRowSelected: { backgroundColor: theme.colors.primaryLight, borderRadius: 12, borderBottomWidth: 0, marginVertical: 2, paddingHorizontal: theme.spacing.xs },
  nearbyReportRowPressed: { opacity: 0.68 },
  nearbyReportIcon: { alignItems: 'center', borderRadius: 12, height: 32, justifyContent: 'center', width: 32 },
  nearbyReportCopy: { flex: 1, marginHorizontal: theme.spacing.sm },
  nearbyReportTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  nearbyReportMeta: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 2 },
  marker: {
    alignItems: 'center',
    borderColor: theme.colors.white,
    borderRadius: 14,
    borderWidth: 2,
    elevation: 5,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  markerSelected: { borderColor: theme.colors.primaryDark, borderWidth: 3 },
  bottomOverlay: { left: theme.spacing.md, position: 'absolute', right: theme.spacing.md },
  reportDetailCard: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: theme.colors.border.light,
    borderRadius: 20,
    borderWidth: 1,
    elevation: 7,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  reportDetailHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  reportDetailTitleRow: { alignItems: 'center', flexDirection: 'row', flex: 1 },
  reportDetailIcon: { alignItems: 'center', borderRadius: 11, height: 36, justifyContent: 'center', width: 36 },
  reportDetailTitleCopy: { flex: 1, marginLeft: 6 },
  reportDetailTitle: { color: theme.colors.text, fontSize: 17, fontWeight: '800' },
  reportDetailAge: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  closeButton: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', marginLeft: theme.spacing.sm, width: 44 },
  reportDetailDescription: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 6 },
  verifyPrompt: { color: theme.colors.text, fontSize: 13, fontWeight: '700', marginTop: 6 },
  verifyRow: { flexDirection: 'row', gap: 6, marginTop: theme.spacing.xs },
  verifyButton: { alignItems: 'center', borderRadius: 12, flex: 1, minHeight: 44, paddingVertical: 10 },
  confirmButton: { backgroundColor: '#E7F6EB' },
  denyButton: { backgroundColor: '#FFF0EF' },
  confirmButtonText: { color: '#24723E', fontSize: 13, fontWeight: '800' },
  denyButtonText: { color: '#B43C36', fontSize: 13, fontWeight: '800' },
  verifyDisabled: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 6 },
  verificationMessage: { color: theme.colors.primaryDark, fontSize: 12, fontWeight: '700', marginTop: 6 },
  parkingSheet: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: theme.colors.border.light,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    ...theme.shadows.large,
  },
  parkingSheetTitle: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  parkingActionRow: { flexDirection: 'row', gap: 6 },
  parkButton: { borderRadius: 12, flex: 1, minHeight: 48 },
  parkButtonText: { fontSize: 15 },
  reportActionButton: { alignItems: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', minHeight: 48, paddingHorizontal: 10 },
  reportActionText: { color: theme.colors.primaryDark, fontSize: 13, fontWeight: '800', marginLeft: 4 },
  reportActionButtonPressed: { opacity: 0.65 },
});
