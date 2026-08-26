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
// react-native, react-dom - the root copy is a different version, kept
// there for the Next.js apps) can resolve to two different physical
// copies depending on which file is importing it - Metro builds one flat
// module graph, so that means two live React instances in the same
// bundle at once ("Invalid hook call" / "Incompatible React versions",
// however deep in the tree - react-native-css-interop, react-native
// itself, react-dom during `expo export`'s web static-render step, etc).
//
// `resolver.extraNodeModules` does NOT fix this - it's only consulted as
// a fallback *after* Metro's normal nodeModulesPaths search already
// finds a match, which react/react-native always do here. The only API
// Metro guarantees is consulted for every single resolution is a custom
// `resolveRequest`, so intercept there and force these two (and their
// subpaths, e.g. react/jsx-runtime) to one canonical directory,
// resolved dynamically via require.resolve since npm's hoisting
// decision for them isn't stable across installs.
const singletonDirs = {
  react: path.dirname(require.resolve("react/package.json", { paths: [projectRoot] })),
  "react-native": path.dirname(
    require.resolve("react-native/package.json", { paths: [projectRoot] })
  ),
  "react-dom": path.dirname(require.resolve("react-dom/package.json", { paths: [projectRoot] })),
};
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [pkg, dir] of Object.entries(singletonDirs)) {
    if (moduleName === pkg || moduleName.startsWith(`${pkg}/`)) {
      // Resolve to a concrete file and hand Metro a sourceFile result
      // directly, rather than rewriting to a path and asking Metro to
      // re-resolve it - for a bare "react" (no subpath), the rewritten
      // path collapses to the package's directory itself, which Metro's
      // resolver treats as a filename stem (appending extensions to
      // ".../node_modules/react") rather than a directory needing
      // package.json/main resolution, and fails.
      try {
        return { type: "sourceFile", filePath: require.resolve(moduleName, { paths: [projectRoot] }) };
      } catch {
        // Platform-specific subpath (e.g. an .ios.js variant) Node's own
        // resolver doesn't know about but Metro's extension fallback
        // does - fall back to the directory-relative rewrite for those.
        const target = path.join(dir, `.${moduleName.slice(pkg.length)}`);
        return (defaultResolveRequest ?? context.resolveRequest)(context, target, platform);
      }
    }
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
