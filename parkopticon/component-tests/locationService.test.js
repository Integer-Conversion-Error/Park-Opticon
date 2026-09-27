import * as Location from 'expo-location';
import { getFastLocation } from '../src/services/locationService';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

const position = { coords: { latitude: 43.642567, longitude: -79.387054, accuracy: 5 } };

beforeEach(() => {
  jest.clearAllMocks();
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Location.getLastKnownPositionAsync.mockResolvedValue(null);
});

afterEach(() => jest.useRealTimers());

test('denied permission stops location access', async () => {
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
  await expect(getFastLocation()).rejects.toThrow('Location permission is required');
  expect(Location.getLastKnownPositionAsync).not.toHaveBeenCalled();
});

test('fresh last-known location avoids another GPS request', async () => {
  Location.getLastKnownPositionAsync.mockResolvedValue(position);
  await expect(getFastLocation()).resolves.toMatchObject({ coords: position.coords, source: 'last-known' });
  expect(Location.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 30_000, requiredAccuracy: 150 });
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

test('current position is used when no fresh cached fix exists', async () => {
  Location.getCurrentPositionAsync.mockResolvedValue(position);
  await expect(getFastLocation()).resolves.toMatchObject({ coords: position.coords, source: 'current' });
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false });
});

test('stale fallback is available only when requested', async () => {
  Location.getCurrentPositionAsync.mockRejectedValue(new Error('GPS unavailable'));
  Location.getLastKnownPositionAsync.mockResolvedValueOnce(null).mockResolvedValueOnce(position);
  await expect(getFastLocation({ allowStaleFallback: true })).resolves.toMatchObject({ coords: position.coords, source: 'stale-fallback' });
  Location.getLastKnownPositionAsync.mockResolvedValue(null);
  await expect(getFastLocation()).rejects.toThrow('GPS unavailable');
});

test('a timed-out fresh fix falls back to the recent fix', async () => {
  jest.useFakeTimers();
  Location.getCurrentPositionAsync.mockImplementation(() => new Promise(() => {}));
  Location.getLastKnownPositionAsync.mockResolvedValueOnce(null).mockResolvedValueOnce(position);
  const result = getFastLocation({ allowStaleFallback: true });
  await jest.advanceTimersByTimeAsync(2500);
  await expect(result).resolves.toMatchObject({ source: 'stale-fallback' });
});
