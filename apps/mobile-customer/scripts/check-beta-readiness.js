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
requireValue(Boolean(app.scheme), "Missing app deep-link scheme for password resets");
requireValue(app.userInterfaceStyle === "automatic", "App must support system appearance");
requireValue(eas.build?.preview?.distribution === "internal", "Preview must use internal distribution");
requireValue(eas.build?.preview?.environment === "preview", "Preview must use the EAS preview environment");
requireValue(
  eas.build?.["preview-simulator"]?.ios?.simulator === true &&
    eas.build?.["preview-simulator"]?.environment === "preview",
  "iOS Simulator beta must use the EAS preview environment"
);
requireValue(
  eas.build?.["play-internal"]?.distribution === "store" &&
    eas.build?.["play-internal"]?.environment === "preview" &&
    eas.build?.["play-internal"]?.android?.buildType === "app-bundle",
  "Google Play internal testing must produce an app bundle against preview services"
);
requireValue(
  eas.submit?.["play-internal"]?.android?.track === "internal",
  "Google Play beta submissions must target the internal track"
);
requireValue(eas.build?.production?.environment === "production", "Production must use the EAS production environment");
requireValue(Boolean(pkg.scripts?.["eas-build-pre-install"]), "Missing EAS release-environment guard");

const releaseEnvGuard = fs.readFileSync(path.join(root, "scripts/validate-release-env.js"), "utf8");
for (const profile of ["preview", "preview-simulator", "play-internal", "production"]) {
  requireValue(releaseEnvGuard.includes(`"${profile}"`), `Release environment guard does not cover ${profile}`);
}

const checkout = fs.readFileSync(path.join(root, "src/app/checkout.tsx"), "utf8");
requireValue(
  checkout.includes("startManualCheckout") &&
    checkout.includes("submitPaymentProof") &&
    checkout.includes("payment_recipient_phone"),
  "Manual Telebirr checkout and receipt verification flow is incomplete"
);

const storeConfig = readJson("store.config.json");
const appleInfo = storeConfig.apple?.info?.["en-US"];
requireValue(
  appleInfo?.privacyPolicyUrl?.startsWith("https://"),
  "Apple metadata requires a public HTTPS privacy policy URL"
);
requireValue(
  appleInfo?.supportUrl?.startsWith("https://"),
  "Apple metadata requires a public HTTPS support URL"
);
requireValue(
  eas.submit?.production && typeof eas.submit.production === "object",
  "Missing production App Store submission profile"
);

if (errors.length) {
  console.error("Private-beta static readiness FAILED:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Mobile release static readiness passed.");
console.log("External requirements still checked by EAS: public HTTPS backend and Medusa publishable key.");
