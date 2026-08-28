import { router } from "expo-router";
import { View } from "react-native";

import { ProductCard } from "@bawi/mobile-ui";
import type { ProductHit } from "@/features/discovery/services/discovery-client";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";

import { SectionHeader } from "./SectionHeader";
import { splitIntoMasonryColumns } from "../utils/masonry";

interface MasonryGridProps {
  title: string;
  subtitle?: string;
  products: ProductHit[];
  seeAllHref?: Parameters<typeof router.push>[0];
}

/** Home's main "shop the edit" surface - a staggered 2-column grid
 * instead of the uniform grid the old Home tab used, so this section
 * alone still reads as a proper editorial layout rather than a plain
 * catalog listing. */
export function MasonryGrid({ title, subtitle, products, seeAllHref }: MasonryGridProps) {
  const { left, right } = splitIntoMasonryColumns(products);

  return (
    <View className="gap-3">
      <SectionHeader title={title} subtitle={subtitle} seeAllHref={seeAllHref} />
      <View className="flex-row gap-3 px-4">
        <View className="flex-1 gap-3">
          {left.map(({ item, aspectRatio }) => (
            <ProductCard
              key={item.productCode}
              product={toProductCardData(item)}
              imageAspectRatio={aspectRatio}
              onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })}
            />
          ))}
        </View>
        <View className="flex-1 gap-3">
          {right.map(({ item, aspectRatio }) => (
            <ProductCard
              key={item.productCode}
              product={toProductCardData(item)}
              imageAspectRatio={aspectRatio}
              onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
