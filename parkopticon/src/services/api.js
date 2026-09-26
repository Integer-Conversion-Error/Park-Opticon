import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from './secureStorage';
import { emitSignedOut } from './authEvents';

const configuredBaseURL = process.env.EXPO_PUBLIC_API_URL;
const API_BASE_URL = configuredBaseURL ? configuredBaseURL.replace(/\/$/, '') : '';
let refreshPromise = null;
let guestMode = false;

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const apiConfigured = Boolean(API_BASE_URL);
export const apiAvailable = () => apiConfigured && !guestMode;
export const setApiGuestMode = (enabled) => { guestMode = Boolean(enabled); };

const parseError = async (response) => {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Keep the response generic when the server did not return JSON.
  }
  const nested = payload?.error;
  const message = typeof nested === 'object' ? nested.message : nested;
  const code = typeof nested === 'object' ? nested.code : undefined;
  return new ApiError(message || `Request failed (${response.status})`, response.status, code);
};

const request = async (path, options = {}, allowRefresh = true) => {
  if (!apiConfigured) {
    throw new ApiError('This build has no backend address. Configure EXPO_PUBLIC_API_URL and rebuild to complete sign-in.', 0, 'api_not_configured');
  }
  if (!apiAvailable()) throw new ApiError('Account sync is unavailable in guest mode.', 0, 'guest_mode');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  const accessToken = await getAccessToken();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    if (response.status === 401 && allowRefresh && !path.includes('/auth/refresh')) {
      await refreshAccessToken();
      return request(path, options, false);
    }
    if (!response.ok) throw await parseError(response);
    if (response.status === 204) return null;
    return response.json();
  } catch (error) {
    if (error?.name === 'AbortError') throw new ApiError('The request timed out. Check your connection and try again.', 0, 'timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new ApiError('Your session has expired.', 401, 'session_expired');
      const response = await request('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }, false);
      await saveTokens(response);
      return response;
    })().catch(async (error) => {
      await clearTokens();
      emitSignedOut();
      throw error;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

export const api = {
  register: async (payload) => {
    const response = await request('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(payload) }, false);
    await saveTokens(response);
    return response;
  },
  login: async (payload) => {
    const response = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(payload) }, false);
    await saveTokens(response);
    return response;
  },
  oauthChallenge: (provider) => request('/api/v1/auth/oauth/challenge', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  }, false),
  socialLogin: async (payload) => {
    const response = await request('/api/v1/auth/oauth/sign-in', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, false);
    await saveTokens(response);
    return response;
  },
  logout: async () => {
    try {
      const refreshToken = await getRefreshToken();
      await request('/api/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }, false);
    } finally {
      await clearTokens();
    }
  },
  identities: () => request('/api/v1/auth/identities'),
  reauthenticate: (payload) => request('/api/v1/auth/reauthenticate', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false),
  linkIdentity: (payload) => request('/api/v1/auth/identities', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, false),
  profile: () => request('/api/v1/profile'),
  communityImpact: () => request('/api/v1/profile/community-impact'),
  preferences: () => request('/api/v1/profile/preferences'),
  updatePreferences: (payload) => request('/api/v1/profile/preferences', { method: 'PATCH', body: JSON.stringify(payload) }),
  nearby: (latitude, longitude, radiusMeters) => request(`/api/v1/feed/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radius_meters=${encodeURIComponent(radiusMeters)}`),
  startSession: (payload) => request('/api/v1/parking-sessions', { method: 'POST', body: JSON.stringify(payload) }),
  endSession: (id, shareOpenSpot) => request(`/api/v1/parking-sessions/${id}/end`, { method: 'PATCH', body: JSON.stringify({ share_open_spot: shareOpenSpot }) }),
  createEnforcementAlert: (payload) => request('/api/v1/enforcement-alerts', { method: 'POST', body: JSON.stringify(payload) }),
  verifyReport: (type, id, payload) => request(`/api/v1/${type === 'parking' ? 'parking-spots' : 'enforcement-alerts'}/${id}/verifications`, { method: 'POST', body: JSON.stringify(payload) }),
  notifications: () => request('/api/v1/notifications'),
  markNotificationRead: (id) => request(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),
  updatePushToken: (pushToken) => request('/api/v1/profile/push-token', {
    method: 'PATCH',
    body: JSON.stringify({ push_token: pushToken }),
  }),
};

export const normalizeFeed = (feed) => [
  ...(feed?.parking_spots || []).map((spot) => ({
    ...spot,
    type: 'parking',
    createdAt: spot.created_at,
    expiresAt: spot.expires_at,
    staleAt: spot.stale_at,
    confidence: Math.min(0.98, Math.max(0.1, 0.6 + (spot.verified_by_count || 0) * 0.035 - (spot.flagged_count || 0) * 0.045)),
    baseConfidence: 0.6,
    confirmations: spot.verified_by_count || 0,
    disputes: spot.flagged_count || 0,
    source: spot.report_source || 'community',
    active: spot.status === 'available',
  })),
  ...(feed?.enforcement_alerts || []).map((alert) => ({
    ...alert,
    type: alert.enforcement_type,
    createdAt: alert.created_at,
    expiresAt: alert.expires_at,
    confidence: Math.min(0.98, Math.max(0.1, 0.6 + (alert.verified_by_count || 0) * 0.035 - (alert.flagged_count || 0) * 0.045)),
    baseConfidence: 0.6,
    confirmations: alert.verified_by_count || 0,
    disputes: alert.flagged_count || 0,
    source: 'community',
    active: alert.status === 'active',
  })),
];
