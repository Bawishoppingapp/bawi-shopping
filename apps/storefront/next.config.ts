import type { NextConfig } from "next";

// The Medusa backend often lives on a different origin than this app in
// a real deployment (e.g. api.example.com vs shop.example.com) - read it
// at build/start time so connect-src/img-src stay correct per
// environment without hardcoding a domain. Falls back to allowing
// nothing extra if unset (local dev without this var still works since
// 'self' covers same-origin Server Actions, which is how this app talks
// to the backend server-side - see docs/DEPLOYMENT.md).
const backendOrigin = (() => {
  try {
    return process.env.MEDUSA_BACKEND_URL ? new URL(process.env.MEDUSA_BACKEND_URL).origin : "";
  } catch {
    return "";
  }
})();

const isDev = process.env.NODE_ENV === "development";

// Storefront-specific: allows Stripe's Payment Element (script + iframe +
// its own API calls) - see docs/PAYMENTS.md. img-src allows any https:
// source because product images are served from wherever the file
// module/S3 provider is configured (see docs/DEPLOYMENT.md §8) - not a
// fixed, predictable host across environments. 'unsafe-inline' (not a
// nonce) is used deliberately so existing static/ISR pages don't have to
// become force-dynamic just to get a CSP header - see docs/SECURITY.md's
// pre-launch hardening section for the trade-off.
const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://api.stripe.com https://m.stripe.network${backendOrigin ? ` ${backendOrigin}` : ""}`,
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: ["@bawi/ui"],
  // Standalone output produces a self-contained .next/standalone folder
  // (server + only the deps actually used, including hoisted workspace
  // packages) - what apps/storefront/Dockerfile copies into its runner
  // stage. See docs/DEPLOYMENT.md.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: cspHeader },
        ],
      },
    ];
  },
};

export default nextConfig;
