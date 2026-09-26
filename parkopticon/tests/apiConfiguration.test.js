import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/services/api.js', import.meta.url), 'utf8');
const loadAPI = async (url) => {
  const unexpected = () => { throw new Error('Unconfigured requests must stop before I/O'); };
  const context = vm.createContext({ process: { env: { EXPO_PUBLIC_API_URL: url } }, fetch: unexpected });
  const module = new vm.SourceTextModule(source, { context });
  await module.link((name) => {
    const names = name === './secureStorage'
      ? ['clearTokens', 'getAccessToken', 'getRefreshToken', 'saveTokens']
      : ['emitSignedOut'];
    return new vm.SyntheticModule(names, function () {
      for (const key of names) this.setExport(key, unexpected);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
};

test('missing backend fails explicitly when completing Google sign-in', async () => {
  const { api } = await loadAPI(undefined);
  await assert.rejects(api.socialLogin({ provider: 'google', authorization_code: 'test-code' }), {
    code: 'api_not_configured', message: /no backend address.*EXPO_PUBLIC_API_URL/,
  });
});

test('configured guest mode still rejects account requests as guest mode', async () => {
  const { api, setApiGuestMode } = await loadAPI('https://api.example.com');
  setApiGuestMode(true);
  await assert.rejects(api.profile(), { code: 'guest_mode' });
});

const response = (status, payload) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => payload,
});

const loadWorkingAPI = async (fetch) => {
  let accessToken = 'old-access';
  let refreshToken = 'old-refresh';
  let signedOut = 0;
  const context = vm.createContext({
    process: { env: { EXPO_PUBLIC_API_URL: 'https://api.example.test' } },
    fetch,
    AbortController,
    setTimeout,
    clearTimeout,
  });
  const module = new vm.SourceTextModule(source, { context });
  await module.link((name) => {
    const exports = name === './secureStorage'
      ? {
          clearTokens: async () => { accessToken = null; refreshToken = null; },
          getAccessToken: async () => accessToken,
          getRefreshToken: async () => refreshToken,
          saveTokens: async (tokens) => { accessToken = tokens.access_token; refreshToken = tokens.refresh_token; },
        }
      : { emitSignedOut: () => { signedOut++; } };
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { api: module.namespace.api, state: () => ({ accessToken, refreshToken, signedOut }) };
};

test('parallel 401 responses share one refresh and retry with the rotated token', async () => {
  const oldRequests = [];
  let refreshes = 0;
  const fetch = async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      refreshes++;
      return response(200, { access_token: 'new-access', refresh_token: 'new-refresh' });
    }
    if (options.headers.Authorization === 'Bearer old-access') {
      return new Promise((resolve) => {
        oldRequests.push(resolve);
        if (oldRequests.length === 2) oldRequests.forEach((done) => done(response(401, { error: 'expired' })));
      });
    }
    assert.equal(options.headers.Authorization, 'Bearer new-access');
    return response(200, { success: true });
  };
  const { api, state } = await loadWorkingAPI(fetch);
  const [profile, preferences] = await Promise.all([api.profile(), api.preferences()]);
  assert.equal(profile.success, true);
  assert.equal(preferences.success, true);
  assert.equal(refreshes, 1);
  assert.equal(state().refreshToken, 'new-refresh');
});

test('refresh failure signs out and clears both tokens', async () => {
  const fetch = async (url) => url.endsWith('/auth/refresh')
    ? response(401, { error: 'revoked' })
    : response(401, { error: 'expired' });
  const { api, state } = await loadWorkingAPI(fetch);
  await assert.rejects(api.profile(), { status: 401 });
  assert.deepEqual(state(), { accessToken: null, refreshToken: null, signedOut: 1 });
});
