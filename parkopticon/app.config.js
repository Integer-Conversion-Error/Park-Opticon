const googleIosUrlScheme =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim();

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
    plugins,
  };
};
