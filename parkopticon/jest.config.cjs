module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/component-tests/**/*.test.[jt]s?(x)'],
  collectCoverageFrom: [
    'src/services/api.js',
    'src/services/authEvents.js',
    'src/services/guestMode.js',
    'src/services/localStore.js',
    'src/services/locationService.js',
    'src/services/pushNotifications.js',
    'src/services/secureStorage.js',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/', '/component-tests/'],
  coverageThreshold: {
    global: { lines: 80, branches: 70 },
  },
};
