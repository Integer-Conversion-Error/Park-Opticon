const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const EXPECTED_VERSION = '1.20.1';
const ANCHOR = `  private BitmapDescriptor getBitmapDescriptorByName(String name) {
    return BitmapDescriptorFactory.fromResource(getDrawableResourceByName(name));
  }
`;
const SNAPSHOT_SIZE = `    int width = this.width <= 0 ? 100 : this.width;
    int height = this.height <= 0 ? 100 : this.height;`;
const LAYOUT_BACKPORT = `
  // Backport the Fabric marker-size fix from react-native-maps PR #5536.
  // Fabric does not send the legacy SizeReportingShadowNode dimensions.
  @Override
  protected void onLayout(boolean changed, int l, int t, int r, int b) {
    super.onLayout(changed, l, t, r, b);
    this.height = b - t;
    this.width = r - l;
  }
`;

module.exports = (config) => withDangerousMod(config, ['android', async (mod) => {
  const packageFile = require.resolve('react-native-maps/package.json', {
    paths: [mod.modRequest.projectRoot],
  });
  const { version } = JSON.parse(await fs.readFile(packageFile, 'utf8'));
  if (version !== EXPECTED_VERSION) {
    throw new Error(`Map marker layout backport requires react-native-maps ${EXPECTED_VERSION}; found ${version}. Review or remove withMapMarkerLayout before upgrading.`);
  }

  const markerFile = path.join(path.dirname(packageFile), 'android/src/main/java/com/rnmaps/maps/MapMarker.java');
  const source = await fs.readFile(markerFile, 'utf8');
  const expectedSource = source.includes('public class MapMarker extends MapFeature {')
    && source.split(ANCHOR).length === 2 && source.includes(SNAPSHOT_SIZE);
  if (expectedSource && source.split(LAYOUT_BACKPORT).length === 2
    && !/\bonLayout\s*\(/.test(source.replace(LAYOUT_BACKPORT, ''))) return mod;
  if (!expectedSource || /\bonLayout\s*\(/.test(source)) {
    throw new Error('Map marker layout backport found incompatible MapMarker.java source. Review withMapMarkerLayout before applying this patch.');
  }

  await fs.writeFile(markerFile, source.replace(ANCHOR, ANCHOR + LAYOUT_BACKPORT));
  return mod;
}]);
