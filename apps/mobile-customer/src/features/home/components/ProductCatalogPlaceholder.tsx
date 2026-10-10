import { ThemedIcon } from "@bawi/mobile-ui";
import { Text, View } from "react-native";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

/** A compact, honest empty state, without blank cards that resemble loading. */
export function ProductCatalogPlaceholder() {
  const t = useTranslations();
  return (
    <View className="mx-4 items-center rounded-2xl border border-ink-100 bg-surface px-6 py-8" style={{ gap: 12 }}>
      <ThemedIcon name="shirt-outline" size={28} tone="ink500" />
      <Text className="text-center font-serif text-h2 text-ink-950">{t("home.productsComingSoon")}</Text>
      <Text className="text-center text-body-sm leading-5 text-ink-500">{t("home.productsComingSoonBody")}</Text>
    </View>
  );
}
