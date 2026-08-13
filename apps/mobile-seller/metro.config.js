const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo awareness: watch the whole workspace (so edits to
// packages/mobile-ui, packages/i18n, packages/search-contract trigger a
// reload) and resolve node_modules from both this app and the hoisted
// root, matching Expo's documented monorepo setup.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Singleton guard: with two nodeModulesPaths, a package that exists in
// both this app's node_modules and the hoisted workspace root's (react,
// react-native) can resolve to two different physical copies depending
// on which file is importing it - Metro builds one flat module graph, so
// that means two live React instances in the same bundle at once
// ("Invalid hook call" / "Incompatible React versions", however deep in
// the tree - react-native-css-interop, react-native itself, etc). Force
// every import of these to the exact same directory regardless of npm's
// hoisting decision that install (it isn't stable across installs - a
// scoped install in just one workspace can move react-native from
// "local to each app" to "hoisted to root" - so resolve dynamically via
// require.resolve rather than a hardcoded path that may not exist this
// time). Anchored on apps/mobile-customer (its versions are the ones
// `expo install --fix` last confirmed match this SDK).
const mobileCustomerDir = path.resolve(workspaceRoot, "apps/mobile-customer");
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.dirname(require.resolve("react/package.json", { paths: [mobileCustomerDir] })),
  "react-native": path.dirname(
    require.resolve("react-native/package.json", { paths: [mobileCustomerDir] })
  ),
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
