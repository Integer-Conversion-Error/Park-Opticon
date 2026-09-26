import React from 'react';
import { fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';
import AuthScreen from '../src/screens/AuthScreen';
import { api } from '../src/services/api';
import { useAppModal } from '../src/components/AppModal';
import { getSocialAuthPayload } from '../src/services/socialAuth';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/services/api', () => ({ api: { login: jest.fn(), register: jest.fn(), socialLogin: jest.fn() } }));
jest.mock('../src/services/socialAuth', () => ({
  getSocialAuthPayload: jest.fn(),
  isGoogleSignInSupported: () => true,
  isSocialAuthCancelled: (error) => error?.code === 'cancelled',
  socialProviderLabels: { google: 'Google', apple: 'Apple' },
}));
jest.mock('../src/components/AppModal', () => ({ useAppModal: jest.fn() }));

const onAuthenticated = jest.fn();
const onGuest = jest.fn();
const showModal = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useAppModal.mockReturnValue({ showModal });
  api.login.mockResolvedValue({});
  api.register.mockResolvedValue({});
  api.socialLogin.mockResolvedValue({});
});

const screen = () => render(<AuthScreen onAuthenticated={onAuthenticated} onGuest={onGuest} />);

test('invalid credentials are rejected before an API request', async () => {
  const view = await screen();
  await userEvent.press(view.getByRole('button', { name: 'Sign in' }));
  expect(showModal).toHaveBeenCalledWith('Check your details', expect.stringContaining('at least 8 characters'));
  expect(api.login).not.toHaveBeenCalled();
});

test('email sign-in authenticates and guest action stays available', async () => {
  const view = await screen();
  await fireEvent.changeText(view.getByPlaceholderText('you@example.com'), 'driver@example.com');
  await fireEvent.changeText(view.getByPlaceholderText('At least 8 characters'), 'passphrase123');
  await userEvent.press(view.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(api.login).toHaveBeenCalledWith({ email: 'driver@example.com', password: 'passphrase123' }));
  expect(onAuthenticated).toHaveBeenCalledTimes(1);
  await userEvent.press(view.getByText('Continue as guest'));
  expect(onGuest).toHaveBeenCalledTimes(1);
});

test('registration derives a username and enters the authenticated app', async () => {
  const view = await screen();
  await userEvent.press(view.getByText('Create an account'));
  await fireEvent.changeText(view.getByPlaceholderText('you@example.com'), ' newdriver@example.com ');
  await fireEvent.changeText(view.getByPlaceholderText('At least 8 characters'), 'passphrase123');
  await userEvent.press(view.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(api.register).toHaveBeenCalledWith({
    email: 'newdriver@example.com', username: 'newdriver', password: 'passphrase123',
  }));
  expect(onAuthenticated).toHaveBeenCalledTimes(1);
});

test('Google provider failure is reported without authenticating', async () => {
  getSocialAuthPayload.mockRejectedValue(new Error('native provider unavailable'));
  const view = await screen();
  await userEvent.press(view.getByRole('button', { name: 'Continue with Google' }));
  await waitFor(() => expect(showModal).toHaveBeenCalledWith('Could not continue with Google', 'native provider unavailable'));
  expect(api.socialLogin).not.toHaveBeenCalled();
  expect(onAuthenticated).not.toHaveBeenCalled();
});
