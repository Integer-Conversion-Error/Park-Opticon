import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const pluginSource = await readFile(new URL('../plugins/withMapMarkerLayout.cjs', import.meta.url), 'utf8');
const packageFile = '/workspace/mobile/node_modules/react-native-maps/package.json';
const markerFile = path.join(path.dirname(packageFile), 'android/src/main/java/com/rnmaps/maps/MapMarker.java');
const originalMarker = `public class MapMarker extends MapFeature {
  private Bitmap createDrawable() {
    int width = this.width <= 0 ? 100 : this.width;
    int height = this.height <= 0 ? 100 : this.height;
  }
  private BitmapDescriptor getBitmapDescriptorByName(String name) {
    return BitmapDescriptorFactory.fromResource(getDrawableResourceByName(name));
  }
}
`;

const loadPlugin = ({ version = '1.20.1', marker = originalMarker } = {}) => {
  let fileMod;
  const writes = [];
  const resolutions = [];
  const dependencies = {
    'expo/config-plugins': { withDangerousMod: (config, [platform, cb]) => {
      assert.equal(platform, 'android');
      fileMod = cb;
      return config;
    } },
    'node:fs/promises': {
      readFile: async (filename) => filename === packageFile ? JSON.stringify({ version }) : marker,
      writeFile: async (filename, text) => { writes.push({ filename, text }); marker = text; },
    },
    'node:path': path,
  };
  const mockedRequire = (name) => dependencies[name];
  mockedRequire.resolve = (name, options) => {
    resolutions.push({ name, paths: [...options.paths] });
    return packageFile;
  };
  const context = vm.createContext({ module: { exports: {} }, require: mockedRequire });
  vm.runInContext(pluginSource, context);
  context.module.exports({});
  const mod = { modRequest: { projectRoot: '/workspace/mobile' } };
  return { apply: () => fileMod(mod), mod, writes, resolutions };
};

test('Android prebuild backports measured marker dimensions once in the resolved app dependency', async () => {
  const fixture = loadPlugin();
  assert.equal(await fixture.apply(), fixture.mod);
  assert.deepEqual(fixture.resolutions, [{ name: 'react-native-maps/package.json', paths: ['/workspace/mobile'] }]);
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0].filename, markerFile);
  assert.match(fixture.writes[0].text, /protected void onLayout\(boolean changed, int l, int t, int r, int b\)/);
  assert.match(fixture.writes[0].text, /super\.onLayout\(changed, l, t, r, b\);\n    this\.height = b - t;\n    this\.width = r - l;/);
  assert.equal(await fixture.apply(), fixture.mod);
  assert.equal(fixture.writes.length, 1, 'repeated prebuild leaves an already patched dependency untouched');
});

test('marker backport rejects an unreviewed dependency upgrade without writing source', async () => {
  const fixture = loadPlugin({ version: '1.26.1' });
  await assert.rejects(fixture.apply(), /requires react-native-maps 1\.20\.1; found 1\.26\.1/);
  assert.equal(fixture.writes.length, 0);
});

test('marker backport rejects changed sizing code or an unknown layout override without writing source', async () => {
  for (const marker of [
    originalMarker.replace('int width = this.width <= 0 ? 100 : this.width;', 'int width = getWidth();'),
    originalMarker.replace('  private Bitmap createDrawable()', '  protected void onLayout() {}\n  private Bitmap createDrawable()'),
  ]) {
    const fixture = loadPlugin({ marker });
    await assert.rejects(fixture.apply(), /incompatible MapMarker\.java source/);
    assert.equal(fixture.writes.length, 0);
  }
});
