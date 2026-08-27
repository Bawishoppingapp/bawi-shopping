import { ActivityIndicator, type ActivityIndicatorProps } from "react-native";

import { useThemeColors } from "./use-theme-colors";

/**
 * ActivityIndicator with its color resolved from the current color
 * scheme instead of a hardcoded hex - every loading spinner in this app
 * used to hardcode `color="#151210"` (invisible against a dark-mode
 * background). Pass `color` explicitly to override (rare - only where a
 * spinner sits on a fixed-color surface regardless of theme, e.g. inside
 * a Button).
 */
export function ThemedActivityIndicator(props: ActivityIndicatorProps) {
  const colors = useThemeColors();
  return <ActivityIndicator color={colors.ink950} {...props} />;
}
