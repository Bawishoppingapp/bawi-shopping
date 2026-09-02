const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Expo SDK 54 discovers npm workspaces and linked monorepo packages
// automatically. Manual watchFolders/nodeModulesPaths overrides can
// reintroduce duplicate native modules.
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./src/global.css" });
