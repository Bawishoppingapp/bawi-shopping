import { ProductCard } from "@bawi/mobile-ui";
import { router } from "expo-router";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCurrency } from "@/features/currency/hooks/use-currency";
import type { ProductHit } from "@/features/discovery/services/discovery-client";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

import { SectionHeader } from "./SectionHeader";

interface ProductGridProps {
  title: string;
  subtitle?: string;
  products: ProductHit[];
  seeAllHref?: Parameters<typeof router.push>[0];
}

export function ProductGrid({ title, subtitle, products, seeAllHref }: ProductGridProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const cardWidth = (width - insets.left - insets.right - 44) / 2;

  return (
    <View style={{ gap: 14 }}>
      <SectionHeader title={title} subtitle={subtitle} seeAllHref={seeAllHref} />
      <View className="flex-row flex-wrap px-4" style={{ columnGap: 12, rowGap: 22 }}>
        {products.map((item) => (
          <View key={item.productCode} style={{ width: cardWidth }}>
            <ProductCard
              product={toProductCardData(item, t, formatPrice)}
              onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
