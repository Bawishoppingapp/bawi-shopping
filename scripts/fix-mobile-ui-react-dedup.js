// packages/mobile-ui and apps/mobile-customer must resolve the exact same
// physical react and react-native install - not just the same version,
// but the same directory - or React throws "Incompatible React versions"
// at runtime (and TypeScript treats same-version-different-directory
// copies as nominally distinct types, breaking exotic component types
// like ForwardRefExoticComponent/Context.Provider - see git history on
// this file). Metro's own resolution is handled separately by
// mobile-customer's metro.config.js (a resolveRequest hook, not a
// symlink); this script exists for TypeScript's own module-identity
// resolution, which doesn't go through Metro at all.
//
// npm's hoisting decision for react/react-native isn't stable across
// installs (it depends on what else is being resolved at the time - a
// scoped `npm install` inside just one workspace can flip react-native
// from "local to each app" to "hoisted to root" while leaving react
// local, or vice versa). Rather than assume a fixed anchor location,
// resolve where apps/mobile-customer *actually* gets each package from
// right now (whether that's local or hoisted to root) and symlink
// packages/mobile-ui to that same real path.
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const root = path.join(__dirname, "..");
const anchorDir = path.join(root, "apps/mobile-customer");
const anchorRequire = createRequire(path.join(anchorDir, "package.json"));

const targetDirs = [path.join(root, "packages/mobile-ui")];

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

// Some packages do `require("react")` from wherever *they* physically
// live, which - when npm hoists them to the workspace root - is NOT the
// same place our three app dirs resolve "react" from (root has its own
// separate react copy for the Next.js apps). Give each of these packages
// its own nested "react" so its internal resolution finds the correct
// (Expo-blessed) copy first, regardless of where npm decided to put it
// this time. react-native needs this for the app to run at all;
// test-renderer needs the identical fix for jest (@testing-library/
// react-native's renderHook/render) to avoid a "two React instances"
// invalid-hook-call error - same root cause, same fix.
function nestReactInto(packageName) {
  try {
    const pkgJsonPath = anchorRequire.resolve(`${packageName}/package.json`);
    const pkgDir = path.dirname(pkgJsonPath);
    const reactPkgJson = anchorRequire.resolve("react/package.json");
    const reactDir = path.dirname(reactPkgJson);
    const nestedReactTarget = path.join(pkgDir, "node_modules", "react");

    if (
      !fs.existsSync(nestedReactTarget) ||
      fs.realpathSync(nestedReactTarget) !== fs.realpathSync(reactDir)
    ) {
      fs.mkdirSync(path.dirname(nestedReactTarget), { recursive: true });
      fs.rmSync(nestedReactTarget, { recursive: true, force: true });
      fs.symlinkSync(reactDir, nestedReactTarget, "dir");
    }
  } catch {
    // Not resolvable from mobile-customer - nothing to fix.
  }
}

nestReactInto("react-native");
nestReactInto("test-renderer");
