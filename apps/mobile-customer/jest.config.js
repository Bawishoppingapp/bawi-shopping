module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|@stripe/stripe-react-native)",
  ],
  // Every React workspace now uses the Expo-compatible 19.1 runtime, so npm
  // hoists one canonical copy. Force Jest and react-reconciler through that
  // same copy to preserve hook identity.
  moduleNameMapper: {
    "^react$": "<rootDir>/../../node_modules/react",
    "^react/jsx-runtime$": "<rootDir>/../../node_modules/react/jsx-runtime",
    "^react/jsx-dev-runtime$": "<rootDir>/../../node_modules/react/jsx-dev-runtime",
  },
};
