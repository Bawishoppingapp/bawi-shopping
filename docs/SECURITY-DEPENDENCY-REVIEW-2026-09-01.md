# Dependency Security Review — 2026-09-01

`npm audit --omit=dev` currently reports 51 production-tree findings: 22 high, 29 moderate, and 0 critical.

## Changes safely completed

- React Router DOM was patched from 6.30.4 to 6.30.6, removing the direct 6.30.4 open-redirect/XSS advisory.
- Every React 19 workspace was aligned to Expo SDK 54's React 19.1.0 runtime. Expo Doctor now passes 18/18 checks with no duplicate native modules.
- The obsolete manual Metro monorepo resolver was removed. Expo SDK 54 workspace discovery is now used directly.

## Why the remaining findings were not force-upgraded

- npm's Expo remediation replaces SDK 54 with Expo 57, which is a framework migration across React Native, Expo Router, native modules, Jest, and both native build projects—not a patch update.
- npm suggests invalid or incompatible Medusa remediations, including downgrading Medusa 2 packages to 1.x/0.x packages. Several Medusa/GraphQL-codegen findings report no valid upstream fix.
- The current `image-size` release is still within the advisory range, so no patched release exists to install.
- React Router's remaining advisory requires the 6-to-7 major migration. Medusa's dashboard and draft-order packages also own router versions, so this must be coordinated with a Medusa-supported upgrade.
- Vite's remediation is a major 5-to-8 migration. It is build tooling, not code served by the customer mobile binary.

Do not run `npm audit fix --force`; its proposed downgrades and major replacements can break the application while providing a misleading sense of safety. Re-run this audit on every lockfile change. Schedule Expo and Medusa migrations independently, with native builds, full unit/integration tests, and staging regression tests for each.

