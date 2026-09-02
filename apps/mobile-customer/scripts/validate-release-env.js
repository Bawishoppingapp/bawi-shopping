const profile = process.env.EAS_BUILD_PROFILE;

if (profile !== "preview" && profile !== "production") {
  process.exit(0);
}

const backendUrl = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "";
const publishableKey = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

let parsedUrl;
try {
  parsedUrl = new URL(backendUrl);
} catch {
  parsedUrl = null;
}

const invalidHost = !parsedUrl || ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);
if (invalidHost || parsedUrl.protocol !== "https:") {
  throw new Error(
    `${profile} builds require EXPO_PUBLIC_MEDUSA_BACKEND_URL to be a public HTTPS backend, not localhost.`
  );
}
if (!publishableKey.trim()) {
  throw new Error(`${profile} builds require EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY.`);
}

console.log(`Validated ${profile} customer-app release environment.`);
