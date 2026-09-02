import { useColorScheme } from "react-native";

/**
 * The subset of `theme.ts`'s colors actually needed as raw hex values at
 * runtime - for props that aren't Tailwind classes and so don't get dark
 * mode for free via the CSS-variable-driven tailwind-preset.js (Ionicons'
 * `color`, ActivityIndicator's `color`, etc.). Mirrors global.css's two
 * palettes exactly - keep in sync by hand, same convention as
 * theme.ts/tailwind-preset.js already use.
 */
export interface ThemeColors {
  ink950: string;
  ink800: string;
  ink700: string;
  ink500: string;
  ink400: string;
  gold600: string;
  surface: string;
  success: string;
}

const LIGHT: ThemeColors = {
  ink950: "#151210",
  ink800: "#312B26",
  ink700: "#4A423B",
  ink500: "#6F655B",
  ink400: "#8C8175",
  gold600: "#B8863B",
  surface: "#FFFFFF",
  success: "#2F7A4D",
};

const DARK: ThemeColors = {
  ink950: "#F3EEE6",
  ink800: "#D8D0C3",
  ink700: "#B8AE9E",
  ink500: "#8F8577",
  ink400: "#6E6459",
  gold600: "#D3A15B",
  surface: "#211D17",
  success: "#4CAF74",
};

/** Reactive to React Native's Appearance API. The mobile app applies its
 * saved in-app preference through that API, keeping raw prop colors and
 * CSS-variable-driven NativeWind classes on the same palette. */
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === "dark" ? DARK : LIGHT;
}
