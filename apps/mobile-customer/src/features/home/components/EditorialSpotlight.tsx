import { router } from "expo-router";
import { View } from "react-native";

import { ProductCard } from "@bawi/mobile-ui";
import type { ProductHit } from "@/features/discovery/services/discovery-client";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { useCurrency } from "@/features/currency/hooks/use-currency";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

import { SectionHeader } from "./SectionHeader";

interface EditorialSpotlightProps {
  title: string;
  subtitle?: string;
  /** Exactly 3, in order: [large, top-right, bottom-right]. */
  products: [ProductHit, ProductHit, ProductHit];
}

function goToProduct(code: string) {
  router.push({ pathname: "/product/[code]", params: { code } });
}

/** One large card beside two stacked smaller ones - the one deliberately
 * asymmetric block on the page, breaking up the rails/grids around it
 * the way a magazine spread breaks up columns of text. */
export function EditorialSpotlight({ title, subtitle, products }: EditorialSpotlightProps) {
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const [large, topRight, bottomRight] = products;

  return (
    <View className="gap-3">
      <SectionHeader title={title} subtitle={subtitle} />
      <View className="flex-row gap-3 px-4">
        <View className="flex-1">
          <ProductCard
            product={toProductCardData(large, t, formatPrice)}
            imageAspectRatio={3 / 4}
            onPress={() => goToProduct(large.productCode)}
          />
        </View>
        <View className="flex-1 gap-3">
          <ProductCard
            product={toProductCardData(topRight, t, formatPrice)}
            imageAspectRatio={1}
            onPress={() => goToProduct(topRight.productCode)}
          />
          <ProductCard
            product={toProductCardData(bottomRight, t, formatPrice)}
            imageAspectRatio={1}
            onPress={() => goToProduct(bottomRight.productCode)}
          />
        </View>
      </View>
    </View>
  );
}
