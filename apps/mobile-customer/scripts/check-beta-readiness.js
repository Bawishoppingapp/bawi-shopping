const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const app = readJson("app.json").expo;
const eas = readJson("eas.json");
const pkg = readJson("package.json");
const errors = [];

const requireValue = (condition, message) => {
  if (!condition) errors.push(message);
};

requireValue(app.name === "Bawi Shopping", "Unexpected app name");
requireValue(Boolean(app.ios?.bundleIdentifier), "Missing iOS bundle identifier");
requireValue(Boolean(app.android?.package), "Missing Android package");
requireValue(Boolean(app.extra?.eas?.projectId), "Missing EAS project ID");
requireValue(app.userInterfaceStyle === "automatic", "App must support system appearance");
requireValue(eas.build?.preview?.distribution === "internal", "Preview must use internal distribution");
requireValue(eas.build?.preview?.environment === "preview", "Preview must use the EAS preview environment");
requireValue(eas.build?.production?.environment === "production", "Production must use the EAS production environment");
requireValue(Boolean(pkg.scripts?.["eas-build-pre-install"]), "Missing EAS release-environment guard");

const checkout = fs.readFileSync(path.join(root, "src/app/checkout.tsx"), "utf8");
requireValue(checkout.includes("comingSoon"), "Payment-disabled beta checkout marker is missing");

if (errors.length) {
  console.error("Private-beta static readiness FAILED:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Private-beta static readiness passed.");
console.log("External requirements still checked by EAS: public HTTPS backend and Medusa publishable key.");

