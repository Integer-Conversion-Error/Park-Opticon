import { Platform } from 'react-native';
import Constants from 'expo-constants';

let notificationsModule;

const getNotifications = () => {
  if (notificationsModule) return notificationsModule;
  // Expo Go has no remote-push implementation. Import the native module only
  // in a build that can actually register a device token.
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  notificationsModule = Notifications;
  return Notifications;
};

export const registerForPushNotifications = async () => {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return null;
  const Notifications = getNotifications();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('parking-alerts', {
      name: 'Parking alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return null;

  const projectId = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID;
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  return tokenResponse.data || null;
};
