// packages/mobile-ui ships raw .tsx source (no build step, same
// no-build convention as packages/ui) and gets its own local react /
// react-native / @types/react install, separate from each Expo app's own
// copy - the workspace root can't hoist a single shared instance because
// root is pinned to React 18 (a transitive requirement of
// @medusajs/dashboard, used by apps/admin). Even when the two copies are
// byte-identical, TypeScript treats them as nominally distinct modules
// when it type-checks an app that imports mobile-ui's raw source
// directly, which breaks exotic-generic component types like
// ForwardRefExoticComponent and Context.Provider ("ReactNode is not
// assignable to ReactNode... bigint is not assignable").
//
// Fix: after every install, replace mobile-ui's and mobile-seller's own
// local react/react-native/@types/react with symlinks into mobile-
// customer's copies, so every consumer resolves the exact same module
// realpath - not just identical content, but the same module identity.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sourceNodeModules = path.join(root, "apps/mobile-customer/node_modules");
const targetNodeModulesList = [
  path.join(root, "packages/mobile-ui/node_modules"),
  path.join(root, "apps/mobile-seller/node_modules"),
];

const packages = ["react", "react-native", "@types/react"];

for (const targetNodeModules of targetNodeModulesList) {
  for (const pkg of packages) {
    const source = path.join(sourceNodeModules, pkg);
    const target = path.join(targetNodeModules, pkg);

    if (!fs.existsSync(source)) continue;
    if (fs.existsSync(target) && fs.realpathSync(target) === fs.realpathSync(source)) continue;

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.rmSync(target, { recursive: true, force: true });
    fs.symlinkSync(source, target, "dir");
  }
}
