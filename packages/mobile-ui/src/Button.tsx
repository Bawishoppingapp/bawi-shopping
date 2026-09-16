import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

import { useThemeColors } from "./use-theme-colors";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "md" | "lg";

interface ButtonProps extends Omit<PressableProps, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: string;
}

const containerByVariant: Record<Variant, string> = {
  primary: "bg-ink-solid active:opacity-90",
  secondary: "bg-transparent border border-ink-200 active:bg-ink-100",
  ghost: "bg-transparent active:bg-ink-100",
  destructive: "bg-danger active:bg-danger/90",
};

const textByVariant: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-ink-950",
  ghost: "text-ink-950",
  destructive: "text-white",
};

const sizeClasses: Record<Size, { container: string; text: string }> = {
  md: { container: "min-h-11 px-4 py-2", text: "text-body" },
  lg: { container: "min-h-14 px-6 py-3", text: "text-h3" },
};

/**
 * Primary interactive control. One primary (`variant="primary"`) per
 * screen for the main action - matches the web design system's own rule
 * (docs/DESIGN-SYSTEM.md §6) that a screen should have exactly one
 * unambiguous primary action.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  onPress,
  ...props
}: ButtonProps) {
  const themeColors = useThemeColors();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`flex-row items-center justify-center rounded-md ${containerByVariant[variant]} ${
        sizeClasses[size].container
      } ${isDisabled ? "opacity-50" : ""} ${className}`}
      onPress={(event) => {
        Haptics.impactAsync(
          variant === "destructive" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
        );
        onPress?.(event);
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" || variant === "ghost" ? themeColors.ink950 : "#FFFFFF"} />
      ) : (
        <Text
          className={`shrink text-center font-medium ${textByVariant[variant]} ${sizeClasses[size].text}`}
          style={{ fontSize: size === "lg" ? 17 : 15, lineHeight: 22, flexShrink: 1 }}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}
