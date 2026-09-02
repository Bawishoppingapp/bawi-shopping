import { router } from "expo-router";
import { FlatList, View } from "react-native";

import { ProductCard } from "@bawi/mobile-ui";
import type { ProductHit } from "@/features/discovery/services/discovery-client";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { useCurrency } from "@/features/currency/hooks/use-currency";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

import { SectionHeader } from "./SectionHeader";

interface ProductRailProps {
  title: string;
  subtitle?: string;
  products: ProductHit[];
  seeAllHref?: Parameters<typeof router.push>[0];
}

/** Single-row horizontal scroller - the plainest of Home's section
 * types, deliberately, so it reads as a fast, glanceable rail next to
 * the heavier editorial/masonry sections around it. */
export function ProductRail({ title, subtitle, products, seeAllHref }: ProductRailProps) {
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  return (
    <View className="gap-3">
      <SectionHeader title={title} subtitle={subtitle} seeAllHref={seeAllHref} />
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={products}
        keyExtractor={(item) => item.productCode}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <View style={{ width: 150 }}>
            <ProductCard
              product={toProductCardData(item, t, formatPrice)}
              onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })}
            />
          </View>
        )}
      />
    </View>
  );
}
