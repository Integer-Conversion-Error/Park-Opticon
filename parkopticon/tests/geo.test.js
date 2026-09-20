import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canVerifyReport, distanceMeters } from '../src/services/geo.js';

const origin = { latitude: 0, longitude: 0 };

for (const [name, from, to, expected] of [
  ['same point', origin, origin, 0],
  ['one degree along equator', origin, { latitude: 0, longitude: 1 }, 111195],
  ['one degree north', origin, { latitude: 1, longitude: 0 }, 111195],
  ['short urban distance', origin, { latitude: 0, longitude: 0.001 }, 111],
  ['longitude at 60 degrees latitude', { latitude: 60, longitude: 0 }, { latitude: 60, longitude: 1 }, 55597],
  ['across antimeridian', { latitude: 0, longitude: 179.999 }, { latitude: 0, longitude: -179.999 }, 222],
  ['near north pole', { latitude: 89, longitude: 0 }, { latitude: 90, longitude: 0 }, 111195],
  ['antipodes', origin, { latitude: 0, longitude: 180 }, 20015087],
  ['antipodal floating-point edge', { latitude: 36, longitude: 0 }, { latitude: -36, longitude: 180 }, 20015087],
]) {
  test(`distance: ${name}`, () => {
    assert.equal(distanceMeters(from, to), expected);
    assert.equal(distanceMeters(to, from), expected, 'distance is symmetric');
  });
}

for (const point of [null, undefined, {}, { latitude: 0 }, { latitude: NaN, longitude: 0 },
  { latitude: 0, longitude: Infinity }, { latitude: 91, longitude: 0 },
  { latitude: 0, longitude: -181 }, { latitude: '0', longitude: 0 }]) {
  test(`invalid/missing coordinates: ${JSON.stringify(point)}`, () => {
    assert.equal(distanceMeters(origin, point), null);
    assert.equal(distanceMeters(point, origin), null);
    assert.equal(canVerifyReport(origin, point), false);
    assert.equal(canVerifyReport(point, origin), false);
  });
}

// Fixed equatorial coordinates corresponding to 299.6, 300, and 300.4 m
// on the mobile spherical model. All display as 300 m after rounding.
for (const [name, longitude, allowed] of [
  ['just inside', 0.002694367531332517, true],
  ['at boundary', 0.0026979648177561915, true],
  ['just outside', 0.0027015621041798665, false],
  ['500 m despite a larger notification preference', 0.004496608029593652, false],
  ['200 m despite a smaller notification preference', 0.0017986432118374607, true],
]) {
  test(`verification: ${name}`, () => {
    assert.equal(canVerifyReport(origin, { latitude: 0, longitude }), allowed);
  });
}

test('rounded display does not grant verification outside the boundary', () => {
  const report = { latitude: 0, longitude: 0.0027015621041798665 };
  assert.equal(distanceMeters(origin, report), 300);
  assert.equal(canVerifyReport(origin, report), false);
});
