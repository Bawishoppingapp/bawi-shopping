// Shared Tailwind preset for both mobile apps, so `apps/mobile-customer`
// and `apps/mobile-seller` render the same Bawi brand tokens via
// NativeWind. Consumed as:
//   presets: [require("nativewind/preset"), require("@bawi/mobile-ui/tailwind-preset")]
// Colors here mirror ./src/theme.ts - keep the two in sync by hand (no
// build step ties them together; this package ships raw TS/JS, consumed
// directly by Metro, same pattern as `packages/ui`).
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#151210",
          800: "#312B26",
          700: "#4A423B",
          500: "#6F655B",
          400: "#8C8175",
          200: "#E3DCD1",
          100: "#EFE9E0",
        },
        paper: "#FBF8F4",
        gold: {
          600: "#B8863B",
          500: "#C79A54",
          100: "#F5E9D3",
        },
        success: "#2F7A4D",
        warning: "#C2410C",
        danger: "#B3261E",
        info: "#3B5BDB",
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
