const googleIosUrlScheme =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();
const googleMapsAndroidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
const localApiHost = process.env.PARKOPTICON_LOCAL_API_HOST?.trim();

if (
  googleIosUrlScheme &&
  !googleIosUrlScheme.startsWith('com.googleusercontent.apps.')
) {
  throw new Error(
    'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME must be the reversed iOS Google client ID (com.googleusercontent.apps.*).'
  );
}

module.exports = ({ config }) => {
  const plugins = [...(config.plugins || [])];
  if (localApiHost) {
    if (process.env.EAS_BUILD_PROFILE === 'production') {
      throw new Error('Local HTTP networking must not be enabled in production builds.');
    }
    plugins.push(['./plugins/withLocalApi.cjs', { host: localApiHost }]);
  }

  // The Google config plugin only needs this iOS URL scheme. Keeping it
  // conditional lets Android-only builds work before an iOS OAuth client exists.
  if (googleIosUrlScheme) {
    plugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: googleIosUrlScheme },
    ]);
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      // android.config is filtered from the public Expo config. Keep only a
      // presence flag so the map can fail explicitly before native creation.
      androidMapsConfigured: Boolean(googleMapsAndroidApiKey || config.android?.config?.googleMaps?.apiKey?.trim()),
    },
    ...(googleMapsAndroidApiKey ? {
      android: {
        ...config.android,
        config: {
          ...config.android?.config,
          googleMaps: {
            ...config.android?.config?.googleMaps,
            apiKey: googleMapsAndroidApiKey,
          },
        },
      },
    } : {}),
    plugins,
  };
};
