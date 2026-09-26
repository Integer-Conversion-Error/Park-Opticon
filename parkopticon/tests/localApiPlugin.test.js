import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isIPv4 } from 'node:net';
import { test } from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../plugins/withLocalApi.cjs', import.meta.url), 'utf8');
const loadPlugin = () => {
  let manifestMod, fileMod, xml;
  const dependencies = {
    'expo/config-plugins': {
      AndroidConfig: { Manifest: { getMainApplicationOrThrow: (m) => m.application } },
      withAndroidManifest: (config, cb) => { manifestMod = cb; return config; },
      withDangerousMod: (config, [, cb]) => { fileMod = cb; return config; },
    },
    'node:fs/promises': { mkdir: async () => {}, writeFile: async (_, text) => { xml = text; } },
    'node:path': path,
    'node:net': { isIPv4 },
  };
  const context = vm.createContext({ module: { exports: {} }, require: (name) => dependencies[name] });
  vm.runInContext(source, context);
  return {
    plugin: context.module.exports,
    apply: async () => {
      const mod = { modResults: { application: { $: {} } }, modRequest: { platformProjectRoot: '/test/android' } };
      manifestMod(mod);
      await fileMod(mod);
      return { xml, manifest: mod.modResults };
    },
  };
};

for (const host of ['10.0.0.47', '100.83.225.2']) {
  test(`local networking allows only ${host}`, async () => {
    const { plugin, apply } = loadPlugin();
    plugin({}, { host });
    const { xml, manifest } = await apply();
    assert.equal(manifest.application.$['android:networkSecurityConfig'], '@xml/parkopticon_local_network');
    assert.ok(xml.includes('<base-config cleartextTrafficPermitted="false" />'));
    assert.ok(xml.includes(`<domain includeSubdomains="false">${host}</domain>`));
    assert.equal((xml.match(/<domain /g) || []).length, 1);
  });
}

test('local networking rejects public hosts and malformed addresses', () => {
  const { plugin } = loadPlugin();
  for (const host of ['8.8.8.8', 'api.example.com', '10.0.0.999', '10.0.0.1</domain>', undefined]) {
    assert.throws(() => plugin({}, { host }), /private IPv4/);
  }
});
