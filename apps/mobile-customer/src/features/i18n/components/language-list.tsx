import { LOCALES, LOCALE_NAMES, type Locale } from "@bawi/i18n/locales";
import { ThemedIcon } from "@bawi/mobile-ui";
import { Pressable, Text, View } from "react-native";

interface LanguageListProps {
  selected: Locale;
  onSelect: (locale: Locale) => void;
}

/** Small, fixed list (6 locales) - a plain vertical list reads better
 * here than a search modal (which the much-longer country list needed,
 * see features/addresses/components/country-picker.tsx). */
export function LanguageList({ selected, onSelect }: LanguageListProps) {
  return (
    <View className="gap-1">
      {LOCALES.map((code) => (
        <Pressable
          key={code}
          accessibilityRole="button"
          accessibilityState={{ selected: code === selected }}
          onPress={() => onSelect(code)}
          className="flex-row items-center justify-between rounded-md px-3 py-3 active:bg-ink-100"
        >
          <Text className="text-body text-ink-950">{LOCALE_NAMES[code]}</Text>
          {code === selected ? <ThemedIcon name="checkmark" size={20} /> : null}
        </Pressable>
      ))}
    </View>
  );
}
