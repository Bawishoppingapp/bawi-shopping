import { ThemedIcon } from "@bawi/mobile-ui";
import { Text, View } from "react-native";

import { useTranslations } from "@/features/i18n/hooks/use-locale";

const PLACEHOLDER_ICONS = ["shirt-outline", "bag-handle-outline", "footsteps-outline", "sparkles-outline"] as const;

/**
 * A static, non-purchasable catalog preview for an empty marketplace.
 * It deliberately avoids fake names, prices, and links so customers cannot
 * mistake a visual placeholder for an approved product.
 */
export function ProductCatalogPlaceholder() {
  const t = useTranslations();

  return (
    <View className="gap-4 px-4">
      <View className="gap-1">
        <Text className="font-serif text-h2 text-ink-950">{t("home.productsComingSoon")}</Text>
        <Text className="text-body-sm leading-5 text-ink-500">{t("home.productsComingSoonBody")}</Text>
      </View>

      <View className="-mx-2 flex-row flex-wrap">
        {PLACEHOLDER_ICONS.map((icon, index) => (
          <View key={`${icon}-${index}`} style={{ width: "50%" }} className="px-2 pb-4">
            <View className="aspect-[4/5] items-center justify-center rounded-lg border border-ink-100 bg-ink-100">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-paper">
                <ThemedIcon name={icon} size={25} tone="ink500" />
              </View>
            </View>
            <View className="mt-2 gap-2">
              <View className="h-3 w-4/5 rounded-full bg-ink-100" />
              <Text className="text-caption font-medium text-ink-500">{t("home.comingSoon")}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
