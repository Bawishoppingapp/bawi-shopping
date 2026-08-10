import { forwardRef, useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
}

/**
 * Label is always visible (never placeholder-as-label) and errors render
 * inline below the field - matches docs/DESIGN-SYSTEM.md §6's forms rule.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, helperText, className = "", onFocus, onBlur, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-1.5">
      <Text className="text-body-sm font-medium text-ink-800">{label}</Text>
      <TextInput
        ref={ref}
        className={`h-12 rounded-md border px-3 text-body text-ink-950 ${
          error ? "border-danger" : focused ? "border-ink-950" : "border-ink-200"
        } ${className}`}
        placeholderTextColor="#8C8175"
        accessibilityLabel={label}
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
      {error ? (
        <Text className="text-body-sm text-danger">{error}</Text>
      ) : helperText ? (
        <Text className="text-body-sm text-ink-500">{helperText}</Text>
      ) : null}
    </View>
  );
});
