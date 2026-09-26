import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SETTINGS,
  REPORTS_KEY,
  SETTINGS_KEY,
  applyVerification,
  appendReport,
  formatTimeAgo,
  getParkingSpotStatus,
  loadReports,
  loadSettings,
  saveSettings,
} from '../src/services/localStore';

jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map();
  return {
    __esModule: true,
    default: {
      data,
      getItem: jest.fn(async (key) => data.get(key) ?? null),
      setItem: jest.fn(async (key, value) => { data.set(key, value); }),
      removeItem: jest.fn(async (key) => { data.delete(key); }),
    },
  };
});

const now = Date.parse('2026-09-26T12:00:00.000Z');
const report = (id, createdAt = now, extras = {}) => ({
  id,
  type: 'parking',
  latitude: 43.642567,
  longitude: -79.387054,
  createdAt: new Date(createdAt).toISOString(),
  active: true,
  ...extras,
});

beforeEach(() => {
  AsyncStorage.data.clear();
  jest.clearAllMocks();
});

test('settings load defaults and clamp a saved radius', async () => {
  expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ notificationsEnabled: false, notificationRadiusMeters: 5000 }));
  expect(await loadSettings()).toMatchObject({ notificationsEnabled: false, notificationRadiusMeters: 1500 });
  expect(JSON.parse(AsyncStorage.data.get(SETTINGS_KEY)).notificationRadiusMeters).toBe(1500);
  await saveSettings({ ...DEFAULT_SETTINGS, notificationRadiusMeters: 50 });
  expect(JSON.parse(AsyncStorage.data.get(SETTINGS_KEY)).notificationRadiusMeters).toBe(100);
});

test('reports discard expired and inactive entries and round public coordinates', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(now);
  try {
    const reports = [
      report('fresh', now - 1000),
      report('expired', now - 16 * 60_000),
      report('inactive', now - 1000, { active: false }),
    ];
    await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
    const visible = await loadReports();
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ id: 'fresh', latitude: 43.6426, longitude: -79.3871 });
    expect(JSON.parse(AsyncStorage.data.get(REPORTS_KEY))).toEqual(visible);
  } finally {
    Date.now.mockRestore();
  }
});

test('malformed report storage recovers and append replaces the same ID', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(now);
  try {
    await AsyncStorage.setItem(REPORTS_KEY, '{broken');
    expect(await loadReports()).toEqual([]);
    await appendReport(report('one'));
    await appendReport(report('one', now, { address: 'Updated' }));
    expect(await loadReports()).toMatchObject([{ id: 'one', address: 'Updated' }]);
  } finally {
    Date.now.mockRestore();
  }
});

test('open spots change from active to stale to expired at the contract boundaries', () => {
  const spot = report('spot', now);
  expect(getParkingSpotStatus(spot, now + 5 * 60_000 - 1)).toBe('active');
  expect(getParkingSpotStatus(spot, now + 5 * 60_000)).toBe('stale');
  expect(getParkingSpotStatus(spot, now + 15 * 60_000)).toBe('expired');
  expect(getParkingSpotStatus({ ...spot, type: 'ticketing' }, now + 30 * 60_000)).toBe('active');
});

test('verification is idempotent and changing a vote replaces its contribution', () => {
  const original = report('spot', now, { baseConfidence: 0.6, confidence: 0.6 });
  const confirmed = applyVerification([original], 'spot', 'confirm');
  expect(confirmed[0]).toMatchObject({ confirmations: 1, disputes: 0, confidence: 0.635, myVote: 'confirm' });
  expect(applyVerification(confirmed, 'spot', 'confirm')).toEqual(confirmed);
  const denied = applyVerification(confirmed, 'spot', 'deny')[0];
  expect(denied).toMatchObject({ confirmations: 0, disputes: 1, myVote: 'deny' });
  expect(denied.confidence).toBeCloseTo(0.555);
  expect(applyVerification(confirmed, 'other', 'deny')).toEqual(confirmed);
});

test('relative time communicates just now, minutes, hours, and days', () => {
  expect(formatTimeAgo(new Date(now).toISOString(), now)).toBe('Just now');
  expect(formatTimeAgo(new Date(now - 2 * 60_000).toISOString(), now)).toBe('2 min ago');
  expect(formatTimeAgo(new Date(now - 2 * 60 * 60_000).toISOString(), now)).toBe('2 hr ago');
  expect(formatTimeAgo(new Date(now - 2 * 24 * 60 * 60_000).toISOString(), now)).toBe('2d ago');
});
