module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|@stripe/stripe-react-native)",
  ],
  // This monorepo's npm hoisting is not stable across installs (see
  // scripts/fix-mobile-ui-react-dedup.js) - test-renderer (a transitive
  // dependency of @testing-library/react-native's renderHook/render) and
  // its own react-reconciler dependency get hoisted to the workspace
  // root, which has a *physically separate* react copy from this app's
  // own node_modules/react. Two react instances in one test run means
  // hooks called on a component this app rendered don't see the
  // dispatcher the *other* react instance set up - "Cannot read
  // properties of null (reading 'useState')". Forcing every `require("react")`
  // (regardless of who's asking) through jest's resolver to this app's
  // own copy is the robust fix - a filesystem symlink only covers one
  // hoisted package at a time and breaks again the next time npm
  // reshuffles hoisting.
  moduleNameMapper: {
    "^react$": "<rootDir>/node_modules/react",
    "^react/jsx-runtime$": "<rootDir>/node_modules/react/jsx-runtime",
    "^react/jsx-dev-runtime$": "<rootDir>/node_modules/react/jsx-dev-runtime",
  },
};
