import React from 'react';
import { render, userEvent, waitFor } from '@testing-library/react-native';
import ReportEnforcementScreen from '../src/screens/ReportEnforcementScreen';
import { api, apiAvailable } from '../src/services/api';
import { appendReport } from '../src/services/localStore';
import { getFastLocation } from '../src/services/locationService';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/services/api', () => ({ api: { createEnforcementAlert: jest.fn() }, apiAvailable: jest.fn() }));
jest.mock('../src/services/localStore', () => ({ appendReport: jest.fn() }));
jest.mock('../src/services/locationService', () => ({ getFastLocation: jest.fn() }));

const position = (accuracy) => ({ coords: { latitude: 43.642567, longitude: -79.387054, accuracy } });
const navigation = { goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  apiAvailable.mockReturnValue(true);
  api.createEnforcementAlert.mockResolvedValue({ id: 'report-id' });
  appendReport.mockResolvedValue([]);
  getFastLocation.mockResolvedValue(position(5));
});

const screen = (location) => render(<ReportEnforcementScreen navigation={navigation} route={{ params: { location } }} />);

test('requires a type and sends a precise online report', async () => {
  const view = await screen({ latitude: 43.642567, longitude: -79.387054, accuracy: 5 });
  expect(view.getByText('Send report')).toBeTruthy();
  await userEvent.press(view.getByRole('button', { name: 'Send report' }));
  expect(api.createEnforcementAlert).not.toHaveBeenCalled();
  await userEvent.press(view.getByRole('radio', { name: 'Ticketing enforcement activity' }));
  await userEvent.press(view.getByRole('button', { name: 'Send report' }));
  await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
  expect(api.createEnforcementAlert).toHaveBeenCalledWith(expect.objectContaining({
    enforcement_type: 'ticketing', accuracy_meters: 5, latitude: 43.642567,
  }));
  expect(getFastLocation).not.toHaveBeenCalled();
});

test('guest report is saved locally with silent on-demand location', async () => {
  apiAvailable.mockReturnValue(false);
  const view = await screen(null);
  await userEvent.press(view.getByRole('radio', { name: 'Chalking enforcement activity' }));
  await userEvent.press(view.getByRole('button', { name: 'Send report' }));
  await waitFor(() => expect(appendReport).toHaveBeenCalledTimes(1));
  expect(appendReport).toHaveBeenCalledWith(expect.objectContaining({ type: 'chalking', latitude: 43.6426 }));
  expect(api.createEnforcementAlert).not.toHaveBeenCalled();
  expect(navigation.goBack).toHaveBeenCalled();
});

test('accuracy above 50 m gives one generic error and submits nothing', async () => {
  getFastLocation.mockResolvedValue(position(80));
  const view = await screen({ latitude: 43.642567, longitude: -79.387054, accuracy: 80 });
  await userEvent.press(view.getByRole('radio', { name: 'Ticketing enforcement activity' }));
  await userEvent.press(view.getByRole('button', { name: 'Send report' }));
  await waitFor(() => expect(view.getByText('Couldn’t send this report yet. Try again.')).toBeTruthy());
  expect(api.createEnforcementAlert).not.toHaveBeenCalled();
  expect(appendReport).not.toHaveBeenCalled();
  expect(navigation.goBack).not.toHaveBeenCalled();
});

test('server rejection presents the same generic error', async () => {
  api.createEnforcementAlert.mockRejectedValue(new Error('database credentials leaked'));
  const view = await screen({ latitude: 43.642567, longitude: -79.387054, accuracy: 5 });
  await userEvent.press(view.getByRole('radio', { name: 'Chalking enforcement activity' }));
  await userEvent.press(view.getByRole('button', { name: 'Send report' }));
  await waitFor(() => expect(view.getByText('Couldn’t send this report yet. Try again.')).toBeTruthy());
  expect(view.queryByText('database credentials leaked')).toBeNull();
  expect(navigation.goBack).not.toHaveBeenCalled();
});
