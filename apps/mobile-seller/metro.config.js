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
// the tree - react-native-css-interop, react-native itself, etc).
//
// `resolver.extraNodeModules` does NOT fix this - it's only consulted as
// a fallback *after* Metro's normal nodeModulesPaths search already
// finds a match, which react/react-native always do here. The only API
// Metro guarantees is consulted for every single resolution is a custom
// `resolveRequest`, so intercept there and force these two (and their
// subpaths, e.g. react/jsx-runtime) to one canonical directory, resolved
// dynamically via require.resolve since npm's hoisting decision for them
// isn't stable across installs. Anchored on apps/mobile-customer (its
// versions are the ones `expo install --fix` last confirmed match this
// SDK) - that app's metro.config.js resolves the same way, so both apps
// always agree.
const mobileCustomerDir = path.resolve(workspaceRoot, "apps/mobile-customer");
const singletonDirs = {
  react: path.dirname(require.resolve("react/package.json", { paths: [mobileCustomerDir] })),
  "react-native": path.dirname(
    require.resolve("react-native/package.json", { paths: [mobileCustomerDir] })
  ),
};
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [pkg, dir] of Object.entries(singletonDirs)) {
    if (moduleName === pkg || moduleName.startsWith(`${pkg}/`)) {
      const target = path.join(dir, `.${moduleName.slice(pkg.length)}`);
      return (defaultResolveRequest ?? context.resolveRequest)(context, target, platform);
    }
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
