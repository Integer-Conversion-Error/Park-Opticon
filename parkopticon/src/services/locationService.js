import * as Location from 'expo-location';

const FAST_LOCATION_MAX_AGE_MS = 30 * 1000;
const FAST_LOCATION_REQUIRED_ACCURACY_M = 150;
const CURRENT_LOCATION_TIMEOUT_MS = 2500;

const withTimeout = (promise, milliseconds) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('Location fix timed out')), milliseconds)),
]);

export const requestLocationPermission = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required to continue.');
  }
};

export const getFastLocation = async ({ allowStaleFallback = false } = {}) => {
  await requestLocationPermission();

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: FAST_LOCATION_MAX_AGE_MS,
    requiredAccuracy: FAST_LOCATION_REQUIRED_ACCURACY_M,
  }).catch(() => null);

  if (lastKnown?.coords) {
    return { ...lastKnown, source: 'last-known' };
  }

  try {
    const current = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: true }),
      CURRENT_LOCATION_TIMEOUT_MS,
    );
    return { ...current, source: 'current' };
  } catch (error) {
    if (allowStaleFallback) {
      const recent = await Location.getLastKnownPositionAsync().catch(() => null);
      if (recent?.coords) return { ...recent, source: 'stale-fallback' };
    }
    throw error;
  }
};
