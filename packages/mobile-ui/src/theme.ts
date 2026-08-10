/**
 * Bawi's native (mobile) design tokens.
 *
 * Same brand DNA as `packages/ui` (the web design system): a neutral,
 * near-black-driven "quiet luxury" palette where product photography does
 * the visual work, not saturated brand color (see docs/DESIGN-SYSTEM.md
 * §2 — "no saturated brand color dominates the UI chrome"). Mobile adds
 * one warm gold accent, used sparingly (price emphasis, badges, active
 * states) — restrained, not decorative.
 *
 * Consumed two ways:
 * - `colors`/`radius`/`fontSize` below, for direct use in RN code
 *   (StyleSheet, inline logic) where a NativeWind class isn't practical.
 * - `./tailwind-preset.js` re-exports these into Tailwind's theme, so
 *   `className="bg-ink-950 text-gold-600"` works via NativeWind in both
 *   mobile apps.
 */

export const colors = {
  // Warm near-black, not pure #000 - primary text, primary buttons.
  ink: {
    950: "#151210",
    800: "#312B26",
    700: "#4A423B",
    500: "#6F655B",
    400: "#8C8175",
    200: "#E3DCD1",
    100: "#EFE9E0",
  },
  // Warm off-white app background + white surfaces (cards, sheets).
  paper: "#FBF8F4",
  white: "#FFFFFF",
  // The one accent color - "Bawi Gold". Sparing use only.
  gold: {
    600: "#B8863B",
    500: "#C79A54",
    100: "#F5E9D3",
  },
  // Semantic - deliberately distinct hues from the gold accent so
  // "featured/premium" and "needs attention" are never visually confused.
  success: "#2F7A4D",
  warning: "#C2410C",
  error: "#B3261E",
  info: "#3B5BDB",
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const;

// Type scale. System fonts for now (San Francisco / Roboto) - a custom
// display/serif pairing for editorial moments (home hero, campaign
// headers) is a deliberate NEXT item once the brand direction is
// validated on-device, not a Phase-0 blocker (see build summary).
export const fontSize = {
  display: 28,
  h1: 24,
  h2: 20,
  h3: 17,
  body: 15,
  bodySm: 13,
  caption: 12,
} as const;

export type IconTone = "ink" | "gold" | "success" | "warning" | "error" | "info";
