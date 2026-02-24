module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/unit/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/contracts/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  collectCoverageFrom: [
    'utils/**/*.ts',
    'lib/api.ts',
    'lib/holdDetection.ts',
    '!**/*.d.ts',
  ],
};
