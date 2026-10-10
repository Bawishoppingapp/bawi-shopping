import { ThemedIcon } from "@bawi/mobile-ui";
import { Image } from "expo-image";
import { router } from "expo-router";
import { FlatList, Platform, Pressable, Text, View } from "react-native";

import type { CategoryNode, ProductHit } from "@/features/discovery/services/discovery-client";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

export function CategoryStrip({ categories, products }: { categories: CategoryNode[]; products: ProductHit[] }) {
  const t = useTranslations();
  const imageProducts = products.filter((product) => product.thumbnail);

  return (
    <View style={{ gap: 12 }}>
      <Text className="px-4 text-h2 font-semibold text-ink-950">{t("home.shopByCategory")}</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories.slice(0, 8)}
        keyExtractor={(category) => category.id}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={3}
        removeClippedSubviews={Platform.OS === "android"}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
        renderItem={({ item }) => {
          const product = imageProducts.find((candidate) => candidate.categoryIds.includes(item.id))
            ?? imageProducts.find((candidate) => candidate.categoryIds.some((id) => item.children.some((child) => child.id === id)));
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => router.push({ pathname: "/(tabs)/search", params: { category: item.id, categoryName: item.name } })}
              className="w-32 active:opacity-80"
            >
              <View className="aspect-[3/4] overflow-hidden bg-ink-100">
                {product?.thumbnail ? (
                  <Image source={{ uri: product.thumbnail }} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" transition={120} />
                ) : (
                  <View className="h-full items-center justify-center"><ThemedIcon name="shirt-outline" size={24} tone="ink400" /></View>
                )}
              </View>
              <Text numberOfLines={1} className="pt-2 text-center text-body-sm font-medium text-ink-950">{item.name}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
