import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { getGuestMode, setGuestMode, clearGuestMode } from '../src/services/guestMode';
import {
  clearPrivateSession,
  clearTokens,
  getAccessToken,
  getPrivateSession,
  getRefreshToken,
  savePrivateSession,
  saveTokens,
} from '../src/services/secureStorage';
import { emitSignedOut, subscribeAuthState } from '../src/services/authEvents';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map();
  return { __esModule: true, default: {
    values,
    getItem: jest.fn(async (key) => values.get(key) ?? null),
    setItem: jest.fn(async (key, value) => { values.set(key, value); }),
    removeItem: jest.fn(async (key) => { values.delete(key); }),
  } };
});

jest.mock('expo-secure-store', () => {
  const values = new Map();
  return {
    AFTER_FIRST_UNLOCK: 'after-first-unlock',
    values,
    getItemAsync: jest.fn(async (key) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => { values.set(key, value); }),
    deleteItemAsync: jest.fn(async (key) => { values.delete(key); }),
  };
});

beforeEach(() => {
  AsyncStorage.values.clear();
  SecureStore.values.clear();
  jest.clearAllMocks();
});

test('guest preference persists and clears', async () => {
  expect(await getGuestMode()).toBe(false);
  await setGuestMode();
  expect(await getGuestMode()).toBe(true);
  await clearGuestMode();
  expect(await getGuestMode()).toBe(false);
});

test('tokens and private parking session are cleared together on sign-out', async () => {
  await saveTokens({ access_token: 'access', refresh_token: 'refresh' });
  await savePrivateSession({ id: 'session', latitude: 43.6 });
  expect(await getAccessToken()).toBe('access');
  expect(await getRefreshToken()).toBe('refresh');
  expect(await getPrivateSession()).toMatchObject({ id: 'session' });
  await clearTokens();
  expect(await getAccessToken()).toBeNull();
  expect(await getRefreshToken()).toBeNull();
  expect(await getPrivateSession()).toBeNull();
});

test('corrupt private session is discarded and can be replaced', async () => {
  SecureStore.values.set('parkopticon.private.active_session', 'not-json');
  expect(await getPrivateSession()).toBeNull();
  expect(SecureStore.values.has('parkopticon.private.active_session')).toBe(false);
  await savePrivateSession({ id: 'new-session' });
  await clearPrivateSession();
  expect(await getPrivateSession()).toBeNull();
});

test('auth events notify active subscribers only', () => {
  const listener = jest.fn();
  const unsubscribe = subscribeAuthState(listener);
  emitSignedOut();
  expect(listener).toHaveBeenCalledWith(false);
  unsubscribe();
  emitSignedOut();
  expect(listener).toHaveBeenCalledTimes(1);
});
