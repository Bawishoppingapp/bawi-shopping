import { ThemedIcon, useThemeColors } from "@bawi/mobile-ui";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COUNTRIES, countryName, type Country } from "../data/countries";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";

interface CountryPickerProps {
  selectedCode: string | null;
  onSelect: (country: Country) => void;
  error?: string;
}

/**
 * A plain RN Modal + FlatList, not a picker library - this project avoids
 * adding a dependency for something this small (see CLAUDE.md rule 10).
 * Free-text country entry was replaced with this because a country
 * selection drives real form behavior downstream (postal code
 * required/optional, phone dial-code hint) - it can't stay a typo-prone
 * text field once the form actually branches on it.
 */
export function CountryPicker({ selectedCode, onSelect, error }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const themeColors = useThemeColors();
  const locale = useLocale();
  const t = useTranslations();

  const selected = COUNTRIES.find((c) => c.code === selectedCode);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => countryName(c.code, locale).toLocaleLowerCase(locale).includes(q));
  }, [query, locale]);

  return (
    <View className="gap-1.5">
      <Text className="text-body-sm font-medium text-ink-800">{t("checkout.country")}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        className={`h-12 flex-row items-center justify-between rounded-md border px-3 ${
          error ? "border-danger" : "border-ink-200"
        } bg-surface`}
      >
        <Text className={selected ? "text-body text-ink-950" : "text-body text-ink-400"}>
          {selected ? countryName(selected.code, locale) : t("address.selectCountry")}
        </Text>
        <ThemedIcon name="chevron-down" size={18} tone="ink400" />
      </Pressable>
      {error ? <Text className="text-body-sm text-danger">{error}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView className="flex-1 bg-paper">
          <View className="flex-row items-center justify-between border-b border-ink-100 px-4 py-3">
            <Text className="text-h2 text-ink-950">{t("address.selectCountry")}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={() => setOpen(false)} className="p-1">
              <ThemedIcon name="close" size={24} />
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("address.searchCountries")}
            placeholderTextColor={themeColors.ink400}
            autoCapitalize="none"
            autoFocus
            className="m-4 h-12 rounded-md border border-ink-200 bg-surface px-3 text-body text-ink-950"
          />
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.code}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={
              <Text className="px-4 py-8 text-center text-body-sm text-ink-500">
                {t("address.noMatches", { query })}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onSelect(item);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex-row items-center justify-between px-4 py-3 active:bg-ink-100"
              >
                <Text className="text-body text-ink-950">{countryName(item.code, locale)}</Text>
                {item.code === selectedCode ? <ThemedIcon name="checkmark" size={20} /> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
