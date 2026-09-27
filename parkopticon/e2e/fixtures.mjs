const base = process.env.PARKOPTICON_E2E_API_URL;
const driverEmail = process.env.PARKOPTICON_E2E_DRIVER_EMAIL;
const driverPassword = process.env.PARKOPTICON_E2E_DRIVER_PASSWORD;
const peerEmail = process.env.PARKOPTICON_E2E_PEER_EMAIL;
const peerPassword = process.env.PARKOPTICON_E2E_PEER_PASSWORD;
const parking = { latitude: 43.642567, longitude: -79.387054 };
const reporting = { latitude: 43.700001, longitude: -79.400001 };

if (![base, driverEmail, driverPassword, peerEmail, peerPassword].every(Boolean)) {
  throw new Error('E2E API and account environment variables are required');
}

const request = async (method, path, token, body) => {
  const result = await fetch(`${base}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  const data = result.status === 204 ? null : await result.json();
  if (!result.ok) throw new Error(`${method} ${path}: HTTP ${result.status} ${JSON.stringify(data)}`);
  return data;
};

const login = async (email, password) => {
  const data = await request('POST', '/api/v1/auth/login', null, { email, password });
  if (!data?.access_token) throw new Error('Login returned no access token');
  return data.access_token;
};

const driver = () => login(driverEmail, driverPassword);
const peer = () => login(peerEmail, peerPassword);
const nearby = (token, point) => request('GET', `/api/v1/feed/nearby?latitude=${point.latitude}&longitude=${point.longitude}&radius_meters=1000`, token);

const eventually = async (description, assertion) => {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { return await assertion(); } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${description} did not become true: ${lastError?.message}`);
};

const actions = {
  setup: async () => {
    await request('POST', '/api/v1/auth/register', null, {
      email: peerEmail,
      username: peerEmail.split('@')[0],
      password: peerPassword,
    });
    console.log('Peer account ready');
  },
  'assert-driver': async () => {
    const token = await driver();
    const profile = await request('GET', '/api/v1/profile', token);
    if ((profile.user || profile).email !== driverEmail) throw new Error('UI registration did not create the driver account');
    console.log('Driver registration verified');
  },
  'assert-active': async () => {
    const token = await driver();
    await eventually('active parking session and preferences', async () => {
      const [active, prefs] = await Promise.all([
        request('GET', '/api/v1/parking-sessions/active', token),
        request('GET', '/api/v1/profile/preferences', token),
      ]);
      if (!active.active || Math.abs(active.session.latitude - parking.latitude) > 0.0002) throw new Error('parking session is absent or at a different location');
      if (prefs.notifications_enabled !== false || prefs.announce_open_spot_after_unparking !== true) throw new Error('UI settings did not sync');
    });
    console.log('Parking start and settings verified');
  },
  'assert-ended': async () => {
    const token = await driver();
    await eventually('ended session and shared spot', async () => {
      const [active, feed] = await Promise.all([
        request('GET', '/api/v1/parking-sessions/active', token),
        nearby(token, parking),
      ]);
      if (active.active || !feed.parking_spots.some((spot) => spot.report_source === 'user_unpark')) throw new Error('session is still active or open spot is absent');
    });
    console.log('Parking end and open spot verified');
  },
  'assert-no-active': async () => {
    const token = await driver();
    const [active, feed] = await Promise.all([
      request('GET', '/api/v1/parking-sessions/active', token),
      nearby(token, parking),
    ]);
    if (active.active) throw new Error('recovered parking session remained active');
    if (feed.parking_spots.filter((spot) => spot.report_source === 'user_unpark').length < 2) {
      throw new Error('recovered offline parking did not share a second server spot');
    }
    console.log('Recovered offline parking ended and shared a server spot');
  },
  'seed-peer-alert': async () => {
    const token = await peer();
    const alert = await request('POST', '/api/v1/enforcement-alerts', token, {
      ...reporting,
      accuracy_meters: 5,
      enforcement_type: 'chalking',
      description: 'E2E peer chalking report',
    });
    if (!alert.id) throw new Error('Peer alert ID missing');
    process.stdout.write(`${alert.id}\n`);
  },
  'seed-far-alert': async () => {
    const token = await peer();
    const alert = await request('POST', '/api/v1/enforcement-alerts', token, {
      latitude: reporting.latitude + 0.0045,
      longitude: reporting.longitude,
      accuracy_meters: 5,
      enforcement_type: 'ticketing',
      description: 'E2E report beyond verification range',
    });
    if (!alert.id) throw new Error('Far alert ID missing');
    process.stdout.write(`${alert.id}\n`);
  },
  'assert-report-and-verification': async () => {
    const token = await driver();
    const feed = await nearby(token, reporting);
    const ownTicketing = feed.enforcement_alerts.find((alert) => alert.enforcement_type === 'ticketing' && alert.id !== process.env.PARKOPTICON_E2E_FAR_ALERT_ID);
    const peerChalking = feed.enforcement_alerts.find((alert) => alert.enforcement_type === 'chalking');
    const far = feed.enforcement_alerts.find((alert) => alert.id === process.env.PARKOPTICON_E2E_FAR_ALERT_ID);
    if (!ownTicketing || !peerChalking || peerChalking.verified_by_count !== 1 || !far || far.verified_by_count !== 0) {
      throw new Error('UI report, nearby verification, or far-distance gate did not reach the API');
    }
    const impact = await request('GET', '/api/v1/profile/community-impact', token);
    if (Number(impact.reports_shared) < 1 || Number(impact.reports_checked) < 1) throw new Error('community impact did not record the actions');
    console.log('Report, verification, and impact verified');
  },
};

const action = actions[process.argv[2]];
if (!action) throw new Error(`Unknown E2E fixture action: ${process.argv[2]}`);
await action();
