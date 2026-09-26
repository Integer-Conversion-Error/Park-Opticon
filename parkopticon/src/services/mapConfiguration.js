export const getMapConfigurationError = ({ platform, executionEnvironment, androidMapsConfigured }) => {
  // Expo Go includes its own Android Maps key; native iOS uses Apple Maps.
  if (platform !== 'android' || executionEnvironment === 'storeClient' || androidMapsConfigured === true) return null;
  return {
    code: 'google_maps_not_configured',
    message: 'This Android build has no Google Maps API key. Set GOOGLE_MAPS_ANDROID_API_KEY and rebuild to use the map.',
  };
};
