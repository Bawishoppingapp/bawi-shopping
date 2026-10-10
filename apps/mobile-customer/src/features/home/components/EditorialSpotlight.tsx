import { ThemedIcon } from "@bawi/mobile-ui";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import type { ProductHit } from "@/features/discovery/services/discovery-client";

import { SectionHeader } from "./SectionHeader";

interface EditorialSpotlightProps {
  title: string;
  subtitle?: string;
  products: [ProductHit, ProductHit, ProductHit];
}

function StoryTile({ product }: { product: ProductHit }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.brand}, ${product.title}`}
      onPress={() => router.push({ pathname: "/product/[code]", params: { code: product.productCode } })}
      className="h-full w-full overflow-hidden bg-ink-100 active:opacity-80"
    >
      {product.thumbnail ? (
        <Image source={{ uri: product.thumbnail }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" transition={120} />
      ) : (
        <View className="h-full items-center justify-center"><ThemedIcon name="shirt-outline" size={24} tone="ink400" /></View>
      )}
    </Pressable>
  );
}

/** One tall photograph beside two squares; their edges meet at the same
 * baseline, so the editorial variation has a deliberate rhythm. */
export function EditorialSpotlight({ title, subtitle, products }: EditorialSpotlightProps) {
  return (
    <View style={{ gap: 14 }}>
      <SectionHeader title={title} subtitle={subtitle} />
      <View className="flex-row px-4" style={{ gap: 10 }}>
        <View className="flex-1" style={{ aspectRatio: 0.49 }}><StoryTile product={products[0]} /></View>
        <View className="flex-1" style={{ gap: 10 }}>
          <View className="w-full flex-1"><StoryTile product={products[1]} /></View>
          <View className="w-full flex-1"><StoryTile product={products[2]} /></View>
        </View>
      </View>
    </View>
  );
}
