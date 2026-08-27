// Shared Tailwind preset for the mobile app, so `apps/mobile-customer`
// renders the same Bawi brand tokens via NativeWind. Consumed as:
//   presets: [require("nativewind/preset"), require("@bawi/mobile-ui/tailwind-preset")]
// Colors here mirror ./src/theme.ts - keep the two in sync by hand (no
// build step ties them together; this package ships raw TS/JS, consumed
// directly by Metro, same pattern as `packages/ui`).
//
// Each color resolves a CSS custom property (defined in
// apps/mobile-customer/src/global.css as space-separated RGB, with a
// `@media (prefers-color-scheme: dark)` override) rather than a fixed
// hex value - this is what makes every `className="bg-paper text-ink-950"`
// etc. across the app automatically respond to system dark mode with no
// per-usage `dark:` variant needed. Only className-based color usage
// gets this for free - a hardcoded `color="#...”` prop passed straight
// to a RN component (Ionicons, ActivityIndicator, etc.) is NOT a
// Tailwind class and does not go through this at all; those use
// useThemeColors() from this package instead (see use-theme-colors.ts).
/** @type {import('tailwindcss').Config} */
const withOpacity = (variable) => `rgb(var(${variable}) / <alpha-value>)`;

module.exports = {
  theme: {
    extend: {
      colors: {
        ink: {
          950: withOpacity("--color-ink-950"),
          800: withOpacity("--color-ink-800"),
          700: withOpacity("--color-ink-700"),
          500: withOpacity("--color-ink-500"),
          400: withOpacity("--color-ink-400"),
          200: withOpacity("--color-ink-200"),
          100: withOpacity("--color-ink-100"),
        },
        paper: withOpacity("--color-paper"),
        // Elevated-card surface (Card, chips, inputs, pickers) - flips to
        // a dark surface in dark mode, unlike `white` (kept as Tailwind's
        // literal, always-white default) which is for content that sits
        // over a photo (gallery dots, sold-out overlays) and must stay
        // white regardless of app theme.
        surface: withOpacity("--color-surface"),
        // A solid dark fill (primary buttons, selected chips, unread
        // dots) that's deliberately NOT part of the ink text scale, so
        // it never inverts to a light color in dark mode - it's always
        // meant to read as "solid, high-contrast surface with white
        // text on top," in both themes.
        "ink-solid": "#151210",
        gold: {
          600: withOpacity("--color-gold-600"),
          500: withOpacity("--color-gold-500"),
          100: withOpacity("--color-gold-100"),
        },
        success: withOpacity("--color-success"),
        warning: withOpacity("--color-warning"),
        danger: withOpacity("--color-danger"),
        info: withOpacity("--color-info"),
      },
      fontSize: {
        display: ["28px", { lineHeight: "34px", fontWeight: "600" }],
        h1: ["24px", { lineHeight: "30px", fontWeight: "600" }],
        h2: ["20px", { lineHeight: "26px", fontWeight: "600" }],
        h3: ["17px", { lineHeight: "22px", fontWeight: "600" }],
        body: ["15px", { lineHeight: "22px" }],
        "body-sm": ["13px", { lineHeight: "18px" }],
        caption: ["12px", { lineHeight: "16px", letterSpacing: "0.02em" }],
      },
    },
  },
};
