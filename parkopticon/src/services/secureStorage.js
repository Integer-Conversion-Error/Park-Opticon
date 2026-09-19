import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'parkopticon.auth.access_token';
const REFRESH_TOKEN_KEY = 'parkopticon.auth.refresh_token';
const PRIVATE_SESSION_KEY = 'parkopticon.private.active_session';

const secureOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const canPersistSecurely = Platform.OS !== 'web';

export const getAccessToken = () => (canPersistSecurely ? SecureStore.getItemAsync(ACCESS_TOKEN_KEY) : Promise.resolve(null));

export const getRefreshToken = () => (canPersistSecurely ? SecureStore.getItemAsync(REFRESH_TOKEN_KEY) : Promise.resolve(null));

export const saveTokens = async ({ access_token: accessToken, refresh_token: refreshToken }) => {
  if (!canPersistSecurely) return;
  if (accessToken) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, secureOptions);
  if (refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, secureOptions);
};

export const clearTokens = async () => {
  if (!canPersistSecurely) return;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(PRIVATE_SESSION_KEY),
  ]);
};

export const getPrivateSession = async () => {
  if (!canPersistSecurely) return null;
  const raw = await SecureStore.getItemAsync(PRIVATE_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    await SecureStore.deleteItemAsync(PRIVATE_SESSION_KEY);
    return null;
  }
};

export const savePrivateSession = async (session) => {
  if (!canPersistSecurely) return session;
  await SecureStore.setItemAsync(PRIVATE_SESSION_KEY, JSON.stringify(session), secureOptions);
  return session;
};

export const clearPrivateSession = () => SecureStore.deleteItemAsync(PRIVATE_SESSION_KEY);
