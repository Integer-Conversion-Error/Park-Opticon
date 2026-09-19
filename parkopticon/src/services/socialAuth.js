import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { api } from './api';

const GOOGLE_PROVIDER = 'google';
const APPLE_PROVIDER = 'apple';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
let configuredGoogleClientId = null;

export const socialProviderLabels = {
  [GOOGLE_PROVIDER]: 'Google',
  [APPLE_PROVIDER]: 'Apple',
};

export class SocialAuthError extends Error {
  constructor(message, code = 'social_auth_failed') {
    super(message);
    this.name = 'SocialAuthError';
    this.code = code;
  }
}

export const isSocialAuthCancelled = (error) => error?.code === 'cancelled';

export const isGoogleSignInSupported = () => Platform.OS === 'android' || Platform.OS === 'ios';
export const isAppleSignInSupported = () => Platform.OS === 'ios';

const cancelledCodes = new Set([
  'CANCELLED',
  'CANCELED',
  'ERR_REQUEST_CANCELED',
  'SIGN_IN_CANCELLED',
]);

const socialAuthCancelled = () => new SocialAuthError('Sign in was cancelled.', 'cancelled');

const toProviderError = (provider, error) => {
  if (error instanceof SocialAuthError) return error;
  if (cancelledCodes.has(error?.code)) return socialAuthCancelled();
  return new SocialAuthError(
    error?.message || `${socialProviderLabels[provider]} sign-in could not be completed.`,
    error?.code || `${provider}_sign_in_failed`,
  );
};

const getGoogleSignIn = () => {
  try {
    // This is intentionally lazy so Expo Go can still open the rest of the app.
    // Google native sign-in requires a development or production native build.
    const googleSignIn = require('@react-native-google-signin/google-signin');
    if (!googleSignIn?.GoogleSignin) {
      throw new SocialAuthError(
        'Google sign-in is not available in this build.',
        'google_unavailable',
      );
    }
    return googleSignIn.GoogleSignin;
  } catch (error) {
    throw toProviderError(GOOGLE_PROVIDER, error);
  }
};

const assertGoogleConfigured = () => {
  if (!isGoogleSignInSupported()) {
    throw new SocialAuthError('Google sign-in is available in the iOS and Android apps.', 'google_unsupported_platform');
  }
  if (!googleWebClientId) {
    throw new SocialAuthError('Google sign-in is not configured for this build. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and rebuild.', 'google_not_configured');
  }
  if (Platform.OS === 'ios' && !googleIosUrlScheme) {
    throw new SocialAuthError('Google sign-in is not configured for this iOS build. Set EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME and rebuild.', 'google_not_configured');
  }
};

const iosClientIdFromUrlScheme = () => (
  googleIosUrlScheme?.split('.').reverse().join('.')
);

const profileName = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return Array.from(normalized).length <= 100 ? normalized : '';
};

const googleAuthorizationCode = async () => {
  try {
    assertGoogleConfigured();
    const GoogleSignin = getGoogleSignIn();
    if (configuredGoogleClientId !== googleWebClientId) {
      const configuration = {
        webClientId: googleWebClientId,
        offlineAccess: true,
        scopes: ['openid', 'email', 'profile'],
      };
      if (Platform.OS === 'ios') configuration.iosClientId = iosClientIdFromUrlScheme();
      GoogleSignin.configure(configuration);
      configuredGoogleClientId = googleWebClientId;
    }
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    if (response?.type === 'cancelled') throw socialAuthCancelled();

    const authorizationCode = response?.data?.serverAuthCode;
    if (!authorizationCode) {
      throw new SocialAuthError('Google did not return an authorization code. Check the Google web client ID and try again.', 'google_missing_authorization_code');
    }
    return {
      authorizationCode,
      fullName: profileName(response?.data?.user?.name),
    };
  } catch (error) {
    throw toProviderError(GOOGLE_PROVIDER, error);
  }
};

const appleFullName = (fullName) => [
  fullName?.namePrefix,
  fullName?.givenName,
  fullName?.middleName,
  fullName?.familyName,
  fullName?.nameSuffix,
].filter(Boolean).join(' ').trim();

const appleIdentityToken = async (nonce) => {
  try {
    if (!isAppleSignInSupported()) {
      throw new SocialAuthError('Apple sign-in is only available on iOS.', 'apple_unsupported_platform');
    }
    const available = await AppleAuthentication.isAvailableAsync();
    if (!available) {
      throw new SocialAuthError('Apple sign-in is not available on this device or build.', 'apple_unavailable');
    }
    const credential = await AppleAuthentication.signInAsync({
      nonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential?.identityToken) {
      throw new SocialAuthError('Apple did not return an identity token. Please try again.', 'apple_missing_identity_token');
    }
    return {
      identityToken: credential.identityToken,
      fullName: profileName(appleFullName(credential.fullName)),
    };
  } catch (error) {
    throw toProviderError(APPLE_PROVIDER, error);
  }
};

const getChallenge = async (provider) => {
  const challenge = await api.oauthChallenge(provider);
  if (!challenge?.nonce || challenge.provider !== provider) {
    throw new SocialAuthError('Could not start secure sign-in. Please try again.', 'invalid_oauth_challenge');
  }
  return challenge;
};

// Apple ID tokens are bound to a one-time server challenge. Google uses an
// authorization code, which the server exchanges using its own client secret.
export const getSocialAuthPayload = async (provider, { includeProfile = false } = {}) => {
  if (provider !== GOOGLE_PROVIDER && provider !== APPLE_PROVIDER) {
    throw new SocialAuthError('That sign-in provider is not supported.', 'unsupported_provider');
  }

  if (provider === GOOGLE_PROVIDER) {
    const { authorizationCode, fullName } = await googleAuthorizationCode();
    return {
      provider,
      authorization_code: authorizationCode,
      ...(includeProfile && fullName ? { full_name: fullName } : {}),
    };
  }

  const { nonce } = await getChallenge(provider);
  const { identityToken, fullName } = await appleIdentityToken(nonce);

  return {
    provider,
    identity_token: identityToken,
    nonce,
    ...(includeProfile && fullName ? { full_name: fullName } : {}),
  };
};
