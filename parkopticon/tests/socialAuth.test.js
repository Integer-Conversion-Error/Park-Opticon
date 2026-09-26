import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/services/socialAuth.js', import.meta.url), 'utf8');

// Execute the actual service with a mocked native registry. Importing the real
// Google SDK here would require a device and hide the missing-module regression.
const loadAuth = async ({ platform = 'android', nativeModule = null, sdk = {} } = {}) => {
  const calls = { imports: 0, registry: 0 };
  const context = vm.createContext({
    process: { env: {
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'test.apps.googleusercontent.com',
      EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME: 'com.googleusercontent.apps.test-ios',
    } },
    require: (name) => {
      assert.equal(name, '@react-native-google-signin/google-signin');
      calls.imports++;
      if (nativeModule === null) throw new Error('getEnforcing: RNGoogleSignin could not be found');
      return sdk;
    },
  });
  const dependencies = {
    'react-native': {
      Platform: { OS: platform },
      TurboModuleRegistry: { get: (name) => {
        assert.equal(name, 'RNGoogleSignin');
        calls.registry++;
        return nativeModule;
      } },
    },
    'expo-apple-authentication': {},
    './api': { api: { oauthChallenge: () => { throw new Error('Google must not request an Apple challenge'); } } },
  };
  const module = new vm.SourceTextModule(source, { context });
  await module.link((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    const exports = dependencies[name];
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { auth: module.namespace, calls };
};

for (const platform of ['android', 'ios']) {
  test(`${platform}: Google stays visible and missing native support fails before SDK import`, async () => {
    const { auth, calls } = await loadAuth({ platform });
    assert.equal(auth.isGoogleSignInSupported(), true, 'missing native support must not hide Google actions');
    assert.equal(calls.registry, 0, 'button visibility depends on platform, not build completeness');
    assert.equal(calls.imports, 0);
    await assert.rejects(auth.getSocialAuthPayload('google'), {
      name: 'SocialAuthError',
      code: 'google_native_module_missing',
      message: /missing RNGoogleSignin.*Rebuild/,
    });
    assert.equal(calls.imports, 0, 'must guard before require, not catch after it');
  });

  test(`${platform}: native builds retain Google authorization-code sign-in`, async () => {
    const configurations = [];
    let playServicesChecks = 0;
    const { auth, calls } = await loadAuth({ platform, nativeModule: {}, sdk: { GoogleSignin: {
      configure: (options) => configurations.push(options),
      hasPlayServices: async () => { playServicesChecks++; },
      signIn: async () => ({ data: { serverAuthCode: 'one-time-code', user: { name: ' Driver ' } } }),
    } } });
    assert.equal(auth.isGoogleSignInSupported(), true);
    assert.equal(calls.imports, 0, 'platform check stays lazy');
    const payload = await auth.getSocialAuthPayload('google', { includeProfile: true });
    assert.equal(payload.authorization_code, 'one-time-code');
    assert.equal(payload.provider, 'google');
    assert.equal(payload.full_name, 'Driver');
    assert.equal(configurations[0].webClientId, 'test.apps.googleusercontent.com');
    assert.equal(configurations[0].offlineAccess, true);
    assert.equal(playServicesChecks, platform === 'android' ? 1 : 0);
    if (platform === 'ios') assert.equal(configurations[0].iosClientId, 'test-ios.apps.googleusercontent.com');
    const repeat = await auth.getSocialAuthPayload('google');
    assert.equal(configurations.length, 1, 'configure once per client ID');
    assert.equal(Object.hasOwn(repeat, 'full_name'), false);
  });
}

test('web never looks up or imports the native Google SDK', async () => {
  const { auth, calls } = await loadAuth({ platform: 'web' });
  assert.equal(auth.isGoogleSignInSupported(), false);
  await assert.rejects(auth.getSocialAuthPayload('google'), { code: 'google_unsupported_platform' });
  assert.equal(calls.registry, 0);
  assert.equal(calls.imports, 0);
});

test('Google cancellation remains a quiet cancellation', async () => {
  const { auth } = await loadAuth({ nativeModule: {}, sdk: { GoogleSignin: {
    configure: () => {}, hasPlayServices: async () => {}, signIn: async () => ({ type: 'cancelled' }),
  } } });
  await assert.rejects(auth.getSocialAuthPayload('google'), (error) => auth.isSocialAuthCancelled(error));
});
