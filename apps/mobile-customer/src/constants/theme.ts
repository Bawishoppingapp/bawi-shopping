import { Platform } from "react-native";

/**
 * Layout constants that aren't color/typography (those live in
 * @bawi/mobile-ui/theme + NativeWind classes - see packages/mobile-ui).
 * Kept separate because they're RN-layout-specific, not design tokens.
 */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
