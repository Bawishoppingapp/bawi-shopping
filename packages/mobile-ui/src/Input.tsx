import { useState, type Ref } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import { ThemedIcon } from "./ThemedIcon";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  ref?: Ref<TextInput>;
}

/**
 * Label is always visible (never placeholder-as-label) and errors render
 * inline below the field - matches docs/DESIGN-SYSTEM.md §6's forms rule.
 * `secureTextEntry` fields automatically get a reveal/hide toggle - every
 * password field in this app wants one, so it lives here once instead of
 * being rebuilt per screen (login, register, seller login/activate all
 * have at least one password field).
 * React 19 takes `ref` as a plain prop - no forwardRef needed (forwardRef's
 * exotic component type doesn't satisfy React 19's JSX element type
 * constraint cleanly in a monorepo with more than one @types/react
 * instance; see https://github.com/react-icons/react-icons/issues/1006).
 */
export function Input({
  label,
  error,
  helperText,
  className = "",
  onFocus,
  onBlur,
  ref,
  secureTextEntry,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPasswordField = Boolean(secureTextEntry);

  return (
    <View className="gap-1.5">
      <Text className="text-body-sm font-medium text-ink-800">{label}</Text>
      <View className="relative justify-center">
        <TextInput
          ref={ref}
          className={`h-12 rounded-md border px-3 text-body text-ink-950 ${
            isPasswordField ? "pr-11" : ""
          } ${error ? "border-danger" : focused ? "border-ink-950" : "border-ink-200"} ${className}`}
          placeholderTextColor="#8C8175"
          accessibilityLabel={label}
          secureTextEntry={isPasswordField ? !revealed : secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {isPasswordField ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            onPress={() => setRevealed((v) => !v)}
            className="absolute right-3 h-6 w-6 items-center justify-center"
            hitSlop={8}
          >
            <ThemedIcon name={revealed ? "eye-off-outline" : "eye-outline"} size={20} tone="ink400" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="text-body-sm text-danger">{error}</Text>
      ) : helperText ? (
        <Text className="text-body-sm text-ink-500">{helperText}</Text>
      ) : null}
    </View>
  );
}
