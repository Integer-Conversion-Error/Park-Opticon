import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcileParkingSession, resolveParkingSessionForEnd } from '../src/services/parkingSession.js';

const local = { id: '1790460000000', latitude: 43.6, longitude: -79.4, address: 'Saved locally', startedAt: '2026-09-26T12:00:00Z' };
const remote = { active: true, session: { id: 'd4c931c4-2dfa-48c7-b402-e9ad58fbd597', latitude: 43.61, longitude: -79.41, address: 'Server address', started_at: '2026-09-26T12:00:02Z' } };

test('server active session replaces a temporary local ID after restart', () => {
  const reconciled = reconcileParkingSession(local, remote);
  assert.equal(reconciled.id, remote.session.id);
  assert.equal(reconciled.startedAt, remote.session.started_at);
  assert.equal(reconciled.latitude, remote.session.latitude);
  assert.equal(reconciled.address, 'Saved locally');
});

test('server session can hydrate a second device without local state', () => {
  const reconciled = reconcileParkingSession(null, remote);
  assert.equal(reconciled.id, remote.session.id);
  assert.equal(reconciled.address, 'Server address');
});

test('server-ended synced session clears stale local state', () => {
  assert.equal(reconcileParkingSession({ ...local, id: remote.session.id }, { active: false }), null);
});

test('offline or unsynced local sessions remain private and available', () => {
  assert.deepEqual(reconcileParkingSession(local, null), local);
  assert.deepEqual(reconcileParkingSession(local, { active: false }), local);
});

test('a previously accepted start is resolved before ending', async () => {
  let created = false;
  const result = await resolveParkingSessionForEnd(local, true, {
    activeSession: async () => remote,
    startSession: async () => { created = true; },
  });
  assert.equal(result.id, remote.session.id);
  assert.equal(created, false);
});

test('an offline start is sent to the server before sharing on recovery', async () => {
  const calls = [];
  const result = await resolveParkingSessionForEnd(local, true, {
    activeSession: async () => { calls.push('active'); return { active: false }; },
    startSession: async (body) => { calls.push('start'); assert.deepEqual(body, {
      latitude: local.latitude,
      longitude: local.longitude,
      address: local.address,
    }); return remote.session; },
  });
  assert.equal(result.id, remote.session.id);
  assert.deepEqual(calls, ['active', 'start']);
});

test('a local session without sharing needs no new server session', async () => {
  let created = false;
  const result = await resolveParkingSessionForEnd(local, false, {
    activeSession: async () => ({ active: false }),
    startSession: async () => { created = true; },
  });
  assert.deepEqual(result, local);
  assert.equal(created, false);
});

test('a start conflict resolves the session created by the earlier request', async () => {
  let queried = 0;
  const result = await resolveParkingSessionForEnd(local, true, {
    activeSession: async () => (++queried === 1 ? { active: false } : remote),
    startSession: async () => { throw { status: 409 }; },
  });
  assert.equal(result.id, remote.session.id);
  assert.equal(queried, 2);
});
