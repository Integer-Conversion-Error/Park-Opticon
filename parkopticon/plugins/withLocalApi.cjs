const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
const { isIPv4 } = require('node:net');

module.exports = (config, { host }) => {
  const [a, b] = String(host).split('.').map(Number);
  const privateAddress = a === 10 || a === 127
    || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
    || (a === 100 && b >= 64 && b <= 127); // Tailscale/CGNAT range.
  if (!isIPv4(host) || !privateAddress) {
    throw new Error('Local API HTTP access requires a private IPv4 address.');
  }
  config = withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    application.$['android:networkSecurityConfig'] = '@xml/parkopticon_local_network';
    return mod;
  });
  return withDangerousMod(config, ['android', async (mod) => {
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'parkopticon_local_network.xml'),
      `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">${host}</domain>
  </domain-config>
</network-security-config>
`);
    return mod;
  }]);
};
