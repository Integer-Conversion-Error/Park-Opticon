import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeNotificationRadius, NOTIFICATION_RADIUS_OPTIONS } from '../src/services/notificationSettings.js';

test('settings choices stop at 1.5 km and retain the 1 km option', () => {
  assert.equal(Math.max(...NOTIFICATION_RADIUS_OPTIONS), 1500);
  assert.ok(NOTIFICATION_RADIUS_OPTIONS.includes(1000));
  assert.ok(NOTIFICATION_RADIUS_OPTIONS.every((radius) => radius >= 100 && radius <= 1500));
});

test('previously saved large radii migrate to 1.5 km', () => {
  for (const radius of [1501, 1750, 2000, 2250, 2500]) {
    assert.equal(normalizeNotificationRadius(radius), 1500);
  }
});

test('existing supported radii are preserved', () => {
  for (const radius of [100, 250, 500, 1000, 1250, 1500]) {
    assert.equal(normalizeNotificationRadius(radius), radius);
  }
});

test('missing or invalid radii use the unchanged 1 km default', () => {
  for (const radius of [undefined, null, NaN, Infinity, '2500']) {
    assert.equal(normalizeNotificationRadius(radius), 1000);
  }
  assert.equal(normalizeNotificationRadius(0), 100);
});
