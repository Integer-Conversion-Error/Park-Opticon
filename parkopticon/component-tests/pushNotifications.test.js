import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from '../src/services/pushNotifications';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  Notifications.setNotificationChannelAsync.mockResolvedValue();
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  Notifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExpoPushToken[test]' });
});

test('a granted permission returns the provider token', async () => {
  await expect(registerForPushNotifications()).resolves.toBe('ExpoPushToken[test]');
  expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
});

test('a denied permission does not contact Expo for a token', async () => {
  Notifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
  Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
  await expect(registerForPushNotifications()).resolves.toBeNull();
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});

test('provider errors remain observable to the map without inventing a token', async () => {
  Notifications.getExpoPushTokenAsync.mockRejectedValue(new Error('push service unavailable'));
  await expect(registerForPushNotifications()).rejects.toThrow('push service unavailable');
});
