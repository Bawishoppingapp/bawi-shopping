// nativewind's own version check (node_modules/nativewind/src/metro/tailwind/index.ts)
// does `import tailwindPackage from "tailwindcss/package.json"`, a bare specifier
// resolved from nativewind's own install location. nativewind's peerDependency
// range (">3.3.0") is loose enough to be satisfied by the Tailwind v4 this
// monorepo's Next.js apps require at the workspace root, so nativewind (hoisted
// to root, since only the two Expo apps need it) ends up resolving root's v4
// instead of the v3 the Expo apps actually install locally - and nativewind only
// supports v3. `npm overrides` can't fix this: legacy-peer-deps (required
// elsewhere in this repo, see .npmrc) skips peer-dependency-aware resolution
// entirely, so an override on a peer edge is never applied.
//
// Fix: after every install, point nativewind's own module resolution at one of
// the Expo apps' local Tailwind v3 install via a real nested node_modules entry.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const source = path.join(root, "apps/mobile-customer/node_modules/tailwindcss");
const target = path.join(root, "node_modules/nativewind/node_modules/tailwindcss");

if (!fs.existsSync(source)) {
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.rmSync(target, { recursive: true, force: true });
fs.symlinkSync(source, target, "dir");
