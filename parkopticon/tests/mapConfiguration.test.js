import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMapConfigurationError } from '../src/services/mapConfiguration.js';

for (const executionEnvironment of ['standalone', 'bare', undefined]) {
  test(`Android ${executionEnvironment}: missing Maps key is an explicit error`, () => {
    for (const androidMapsConfigured of [undefined, false, 'true']) {
      const error = getMapConfigurationError({ platform: 'android', executionEnvironment, androidMapsConfigured });
      assert.equal(error.code, 'google_maps_not_configured');
      assert.match(error.message, /GOOGLE_MAPS_ANDROID_API_KEY.*rebuild/);
    }
  });
}

test('Expo Go retains working guest maps without a project Maps key', () => {
  assert.equal(getMapConfigurationError({ platform: 'android', executionEnvironment: 'storeClient', androidMapsConfigured: false }), null);
});

test('properly configured Android builds can mount the map', () => {
  assert.equal(getMapConfigurationError({ platform: 'android', executionEnvironment: 'standalone', androidMapsConfigured: true }), null);
});

test('iOS Apple Maps does not require an Android Google Maps key', () => {
  assert.equal(getMapConfigurationError({ platform: 'ios', executionEnvironment: 'standalone', androidMapsConfigured: false }), null);
});
