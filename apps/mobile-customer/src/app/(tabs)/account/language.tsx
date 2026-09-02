import { Stack, router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LanguageList } from "@/features/i18n/components/language-list";
import { useLocale, useSetLocale, useTranslations } from "@/features/i18n/hooks/use-locale";

export default function LanguageScreen() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const t = useTranslations();

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: t("common.language") }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View className="gap-1">
          <Text className="text-body-sm text-ink-500">
            {t("account.languageDescription")}
          </Text>
        </View>
        <LanguageList
          selected={locale}
          onSelect={(next) => {
            setLocale(next);
            router.back();
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
