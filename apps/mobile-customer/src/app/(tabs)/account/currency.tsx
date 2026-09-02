import { Card, ThemedIcon } from "@bawi/mobile-ui";
import { Stack, router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DISPLAY_CURRENCIES, useCurrency } from "@/features/currency/hooks/use-currency";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

export default function CurrencyScreen() {
  const { currency, setCurrency } = useCurrency();
  const t = useTranslations();

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: t("account.currency") }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text className="text-body-sm text-ink-500">{t("account.currencyDescription")}</Text>
        <Card padded={false} className="overflow-hidden">
          {DISPLAY_CURRENCIES.map((code) => (
            <Pressable
              key={code}
              accessibilityRole="radio"
              accessibilityState={{ checked: currency === code }}
              className="flex-row items-center gap-3 border-b border-ink-100 px-4 py-4 active:bg-ink-100"
              onPress={() => {
                setCurrency(code);
                router.back();
              }}
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-body font-medium text-ink-950">
                  {code === "etb" ? t("currency.etb") : t("currency.usd")}
                </Text>
                <Text className="text-body-sm text-ink-500">{code.toUpperCase()}</Text>
              </View>
              {currency === code ? <ThemedIcon name="checkmark-circle" size={22} tone="gold600" /> : null}
            </Pressable>
          ))}
        </Card>
        <Text className="text-caption leading-5 text-ink-500">{t("account.currencyNotice")}</Text>
        <Text className="text-caption text-ink-400">{t("account.currencyAttribution")}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
