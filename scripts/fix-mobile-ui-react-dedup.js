// packages/mobile-ui, apps/mobile-customer, and apps/mobile-seller must
// all resolve the exact same physical react and react-native install -
// not just the same version, but the same directory - or React throws
// "Incompatible React versions" at runtime (and TypeScript treats
// same-version-different-directory copies as nominally distinct types,
// breaking exotic component types like ForwardRefExoticComponent/
// Context.Provider - see git history on this file).
//
// npm's hoisting decision for react/react-native isn't stable across
// installs (it depends on what else is being resolved at the time - a
// scoped `npm install` inside just one workspace can flip react-native
// from "local to each app" to "hoisted to root" while leaving react
// local, or vice versa). Rather than assume a fixed anchor location,
// resolve where apps/mobile-customer *actually* gets each package from
// right now (whether that's local or hoisted to root) and symlink
// mobile-seller and packages/mobile-ui to that same real path.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const root = path.join(__dirname, "..");
const anchorDir = path.join(root, "apps/mobile-customer");
const anchorRequire = createRequire(path.join(anchorDir, "package.json"));

const targetDirs = [path.join(root, "packages/mobile-ui"), path.join(root, "apps/mobile-seller")];

const packages = ["react", "react-native", "@types/react"];

for (const pkg of packages) {
  let sourceDir;
  try {
    const pkgJsonPath = anchorRequire.resolve(`${pkg}/package.json`);
    sourceDir = path.dirname(pkgJsonPath);
  } catch {
    continue; // mobile-customer doesn't have this package resolvable - nothing to align.
  }

  for (const targetDir of targetDirs) {
    const target = path.join(targetDir, "node_modules", pkg);

    if (fs.existsSync(target) && fs.realpathSync(target) === fs.realpathSync(sourceDir)) {
      continue; // already aligned
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.rmSync(target, { recursive: true, force: true });
    fs.symlinkSync(sourceDir, target, "dir");
  }
}

// react-native's own internal code does `require("react")` from wherever
// react-native itself physically lives - which, when npm hoists it to the
// workspace root, is NOT the same place our three app dirs resolve
// "react" from (root has its own separate react copy for the Next.js
// apps). Give react-native its own nested "react" so its internal
// resolution finds the correct (Expo-blessed) copy first, regardless of
// where npm decided to put react-native this time.
try {
  const reactNativePkgJson = anchorRequire.resolve("react-native/package.json");
  const reactNativeDir = path.dirname(reactNativePkgJson);
  const reactPkgJson = anchorRequire.resolve("react/package.json");
  const reactDir = path.dirname(reactPkgJson);
  const nestedReactTarget = path.join(reactNativeDir, "node_modules", "react");

  if (
    !fs.existsSync(nestedReactTarget) ||
    fs.realpathSync(nestedReactTarget) !== fs.realpathSync(reactDir)
  ) {
    fs.mkdirSync(path.dirname(nestedReactTarget), { recursive: true });
    fs.rmSync(nestedReactTarget, { recursive: true, force: true });
    fs.symlinkSync(reactDir, nestedReactTarget, "dir");
  }
} catch {
  // react-native not resolvable from mobile-customer - nothing to fix.
}
