jest.mock('../src/services/secureStorage', () => ({
  clearTokens: jest.fn(),
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveTokens: jest.fn(),
}));
jest.mock('../src/services/authEvents', () => ({ emitSignedOut: jest.fn() }));

const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

const load = () => {
  jest.resetModules();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  const storage = require('../src/services/secureStorage');
  const events = require('../src/services/authEvents');
  storage.getAccessToken.mockResolvedValue('access');
  storage.getRefreshToken.mockResolvedValue('refresh');
  storage.saveTokens.mockResolvedValue();
  storage.clearTokens.mockResolvedValue();
  return { ...require('../src/services/api'), storage, events };
};

afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
  delete global.fetch;
});

test('registration sends JSON to the configured origin and saves issued tokens', async () => {
  const { api, storage } = load();
  global.fetch = jest.fn(async () => response(201, { access_token: 'new-access', refresh_token: 'new-refresh' }));
  await api.register({ email: 'driver@example.invalid', username: 'driver', password: 'password123' });
  expect(global.fetch).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/register', expect.objectContaining({
    method: 'POST', headers: expect.objectContaining({ 'Content-Type': 'application/json', Authorization: 'Bearer access' }),
  }));
  expect(storage.saveTokens).toHaveBeenCalledWith({ access_token: 'new-access', refresh_token: 'new-refresh' });
});

test('nested API errors retain status and code without losing the message', async () => {
  const { api } = load();
  global.fetch = jest.fn(async () => response(422, { error: { code: 'bad_radius', message: 'Radius too large' } }));
  await expect(api.updatePreferences({ notification_radius_meters: 2000 })).rejects.toMatchObject({
    status: 422, code: 'bad_radius', message: 'Radius too large',
  });
});

test('guest mode blocks protected requests before network I/O', async () => {
  const { api, setApiGuestMode } = load();
  global.fetch = jest.fn();
  setApiGuestMode(true);
  await expect(api.profile()).rejects.toMatchObject({ code: 'guest_mode' });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('one failed refresh clears credentials and signs out', async () => {
  const { api, storage, events } = load();
  global.fetch = jest.fn(async (url) => url.endsWith('/auth/refresh')
    ? response(401, { error: 'revoked' })
    : response(401, { error: 'expired' }));
  await expect(api.profile()).rejects.toMatchObject({ status: 401 });
  expect(storage.clearTokens).toHaveBeenCalledTimes(1);
  expect(events.emitSignedOut).toHaveBeenCalledTimes(1);
});

test('feed normalization preserves report kinds and derived confidence', () => {
  const { normalizeFeed } = load();
  const reports = normalizeFeed({
    parking_spots: [{ id: 'spot', created_at: '2026-09-26', status: 'available', verified_by_count: 2 }],
    enforcement_alerts: [{ id: 'alert', enforcement_type: 'chalking', created_at: '2026-09-26', status: 'active', flagged_count: 2 }],
  });
  expect(reports).toMatchObject([
    { id: 'spot', type: 'parking', active: true, confirmations: 2 },
    { id: 'alert', type: 'chalking', active: true, disputes: 2 },
  ]);
  expect(reports[0].confidence).toBeCloseTo(0.67);
  expect(reports[1].confidence).toBeCloseTo(0.51);
});
