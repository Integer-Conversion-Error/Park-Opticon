import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../app.config.js', import.meta.url), 'utf8');
const configure = (env, config) => {
  const context = vm.createContext({ process: { env }, module: { exports: {} } });
  vm.runInContext(source, context);
  return context.module.exports({ config });
};

test('Android Maps key reaches native configuration without dropping existing settings', () => {
  const result = configure({ GOOGLE_MAPS_ANDROID_API_KEY: ' test-maps-key ' }, {
    android: { package: 'com.parkopticon.app', config: { existing: true } },
    plugins: ['expo-location'],
  });
  assert.equal(result.android.config.googleMaps.apiKey, 'test-maps-key');
  assert.equal(result.android.package, 'com.parkopticon.app');
  assert.equal(result.android.config.existing, true);
  assert.equal(result.plugins[0], 'expo-location');
  assert.equal(result.extra.androidMapsConfigured, true);
});

test('Expo Go config does not invent an Android Maps key', () => {
  const result = configure({}, { android: { package: 'com.parkopticon.app' } });
  assert.equal(result.android.config?.googleMaps?.apiKey, undefined);
  assert.equal(result.extra.androidMapsConfigured, false);
});

test('map availability retains EAS metadata and recognizes a static native key', () => {
  const result = configure({}, {
    android: { config: { googleMaps: { apiKey: 'existing-key' } } },
    extra: { eas: { projectId: 'test-project' } },
  });
  assert.equal(result.extra.androidMapsConfigured, true);
  assert.equal(result.extra.eas.projectId, 'test-project');
});

test('Google iOS scheme and Android Maps configuration coexist', () => {
  const result = configure({
    GOOGLE_MAPS_ANDROID_API_KEY: 'test-maps-key',
    EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME: 'com.googleusercontent.apps.test',
  }, {});
  assert.equal(result.android.config.googleMaps.apiKey, 'test-maps-key');
  assert.equal(result.plugins[0][0], '@react-native-google-signin/google-signin');
  assert.equal(result.plugins[0][1].iosUrlScheme, 'com.googleusercontent.apps.test');
});

test('local HTTP is explicitly enabled only when a host is provided', () => {
  assert.equal(configure({}, {}).plugins.some((p) => p[0] === './plugins/withLocalApi.cjs'), false);
  const local = configure({ PARKOPTICON_LOCAL_API_HOST: '10.0.0.47' }, {});
  assert.equal(local.plugins[0][0], './plugins/withLocalApi.cjs');
  assert.equal(local.plugins[0][1].host, '10.0.0.47');
  assert.throws(() => configure({ PARKOPTICON_LOCAL_API_HOST: '10.0.0.47', EAS_BUILD_PROFILE: 'production' }, {}), /must not be enabled in production/);
});
