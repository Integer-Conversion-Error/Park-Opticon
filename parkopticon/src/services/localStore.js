import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACTIVE_PARKING_KEY = 'parkopticon.activeParking.v1';
export const REPORTS_KEY = 'parkopticon.reports.v2';
export const SETTINGS_KEY = 'parkopticon.settings.v1';
export const PARKING_SPOT_STALE_AFTER_MS = 5 * 60 * 1000;
export const PARKING_SPOT_EXPIRES_AFTER_MS = 15 * 60 * 1000;

export const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  notificationRadiusMeters: 1000,
  // Retained for compatibility with existing preference records; the map no
  // longer interrupts parking with an enforcement-question modal.
  askAboutEnforcementAfterParking: false,
  announceOpenSpotAfterUnparking: false,
};

export const REPORT_TYPE_META = {
  ticketing: {
    label: 'Writing tickets',
    shortLabel: 'Ticketing',
    icon: 'ticket-outline',
    color: '#D94841',
    description: 'An officer is actively writing parking tickets.',
  },
  chalking: {
    label: 'Chalking tires',
    shortLabel: 'Chalking',
    icon: 'create-outline',
    color: '#C47716',
    description: 'An officer is marking tires to track parking time.',
  },
  parking: {
    label: 'Open parking',
    shortLabel: 'Parking',
    icon: 'car-outline',
    color: '#2E9B57',
    description: 'A community member reported an available space.',
  },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const parseStoredJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const loadSettings = async () => {
  const stored = parseStoredJson(await AsyncStorage.getItem(SETTINGS_KEY), {});
  return { ...DEFAULT_SETTINGS, ...stored };
};

export const saveSettings = async (settings) => {
  const nextSettings = { ...DEFAULT_SETTINGS, ...settings };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  return nextSettings;
};

export const getParkingSpotStatus = (report, now = Date.now()) => {
  if (report.type !== 'parking') return 'active';
  const createdAt = new Date(report.createdAt).getTime();
  const expiresAt = report.expiresAt
    ? new Date(report.expiresAt).getTime()
    : createdAt + PARKING_SPOT_EXPIRES_AFTER_MS;
  if (now >= expiresAt || now - createdAt >= PARKING_SPOT_EXPIRES_AFTER_MS)
    return 'expired';
  if (now - createdAt >= PARKING_SPOT_STALE_AFTER_MS) return 'stale';
  return 'active';
};

export const isReportVisible = (report, now = Date.now()) =>
  report.active !== false && getParkingSpotStatus(report, now) !== 'expired';

export const loadReports = async () => {
  const reports = parseStoredJson(await AsyncStorage.getItem(REPORTS_KEY), []);
  const visibleReports = reports
    .filter((report) => isReportVisible(report))
    .map((report) => ({
      ...report,
      latitude:
        typeof report.latitude === 'number'
          ? Number(report.latitude.toFixed(4))
          : report.latitude,
      longitude:
        typeof report.longitude === 'number'
          ? Number(report.longitude.toFixed(4))
          : report.longitude,
    }));
  if (
    visibleReports.length !== reports.length ||
    JSON.stringify(visibleReports) !== JSON.stringify(reports)
  ) {
    await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(visibleReports));
  }
  return visibleReports;
};

export const saveReports = async (reports) => {
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  return reports;
};

export const appendReport = async (report) => {
  const reports = await loadReports();
  const nextReports = [
    report,
    ...reports.filter((item) => item.id !== report.id),
  ];
  await saveReports(nextReports);
  return nextReports;
};

export const formatTimeAgo = (createdAt, now = Date.now()) => {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(createdAt).getTime()) / 60000)
  );
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;
  return `${Math.floor(elapsedHours / 24)}d ago`;
};

export const getReportMeta = (report) =>
  REPORT_TYPE_META[report.type] || REPORT_TYPE_META.ticketing;

export const distanceMeters = (from, to) => {
  if (!from || !to) return null;
  const earthRadius = 6371000;
  const latitudeDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const longitudeDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLatitude = (from.latitude * Math.PI) / 180;
  const toLatitude = (to.latitude * Math.PI) / 180;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(
    earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  );
};

export const applyVerification = (reports, reportId, vote) =>
  reports.map((report) => {
    if (report.id !== reportId || !['confirm', 'deny'].includes(vote))
      return report;

    const previousVote = report.myVote;
    if (previousVote === vote) return report;

    let confirmations = report.confirmations || 0;
    let disputes = report.disputes || 0;
    if (previousVote === 'confirm') confirmations -= 1;
    if (previousVote === 'deny') disputes -= 1;
    if (vote === 'confirm') confirmations += 1;
    if (vote === 'deny') disputes += 1;

    const baseConfidence = report.baseConfidence ?? report.confidence ?? 0.6;
    const confidence = clamp(
      baseConfidence + confirmations * 0.035 - disputes * 0.045,
      0.1,
      0.98
    );
    return {
      ...report,
      confirmations,
      disputes,
      confidence,
      myVote: vote,
    };
  });
