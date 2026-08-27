import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

import { useThemeColors } from "./use-theme-colors";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type Tone = "ink950" | "ink800" | "ink700" | "ink500" | "ink400" | "gold600";

interface ThemedIconProps {
  name: IoniconName;
  size: number;
  tone?: Tone;
}

/**
 * A plain Ionicons wrapper that resolves its color from the current
 * color scheme instead of a hardcoded hex - for the many icons across
 * this app that used to hardcode `color="#151210"` etc. directly
 * (invisible against a dark-mode background). Defaults to "ink950"
 * (primary-text-weight icons); pass `tone` for the lighter secondary/
 * tertiary weights.
 */
export function ThemedIcon({ name, size, tone = "ink950" }: ThemedIconProps) {
  const colors = useThemeColors();
  return <Ionicons name={name} size={size} color={colors[tone]} />;
}
