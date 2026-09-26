import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../src/screens/SettingsScreen';
import { api, apiAvailable } from '../src/services/api';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/services/localStore';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../src/services/api', () => ({
  apiAvailable: jest.fn(),
  api: { preferences: jest.fn(), updatePreferences: jest.fn() },
}));
jest.mock('../src/services/localStore', () => ({
  DEFAULT_SETTINGS: { notificationsEnabled: true, notificationRadiusMeters: 1000, askAboutEnforcementAfterParking: false, announceOpenSpotAfterUnparking: false },
  loadSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  apiAvailable.mockReturnValue(true);
  loadSettings.mockResolvedValue(DEFAULT_SETTINGS);
  saveSettings.mockImplementation(async (value) => value);
  api.preferences.mockResolvedValue({
    notifications_enabled: true,
    notification_radius_meters: 1000,
    ask_about_enforcement_after_parking: false,
    announce_open_spot_after_unparking: false,
  });
  api.updatePreferences.mockResolvedValue({});
});

test('a signed-in switch change persists locally and through the API', async () => {
  const view = await render(<SettingsScreen />);
  await waitFor(() => expect(api.preferences).toHaveBeenCalled());
  await fireEvent(view.getByTestId('settings-share-open-spot-switch'), 'valueChange', true);
  await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ announceOpenSpotAfterUnparking: true })));
  expect(api.updatePreferences).toHaveBeenCalledWith(expect.objectContaining({ announce_open_spot_after_unparking: true }));
});

test('guest settings persist only on the device', async () => {
  apiAvailable.mockReturnValue(false);
  const view = await render(<SettingsScreen />);
  await waitFor(() => expect(loadSettings).toHaveBeenCalled());
  await fireEvent(view.getByTestId('settings-notifications-switch'), 'valueChange', false);
  await waitFor(() => expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ notificationsEnabled: false })));
  expect(api.preferences).not.toHaveBeenCalled();
  expect(api.updatePreferences).not.toHaveBeenCalled();
});
