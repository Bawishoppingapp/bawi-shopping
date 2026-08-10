import { DEFAULT_LOCALE } from "@bawi/i18n/locales";
import { ProductCard } from "@bawi/mobile-ui";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, Text, View } from "react-native";

import { type CategoryNode, type ProductHit, listCategories, searchProducts } from "@/features/discovery/services/discovery-client";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";

const NEW_ARRIVALS_LIMIT = 12;

export default function HomeScreen() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    const [categoriesResult, arrivalsResult] = await Promise.allSettled([
      listCategories(DEFAULT_LOCALE),
      searchProducts({ sort: "newest", limit: NEW_ARRIVALS_LIMIT, locale: DEFAULT_LOCALE }),
    ]);
    if (categoriesResult.status === "fulfilled") setCategories(categoriesResult.value);
    if (arrivalsResult.status === "fulfilled") setNewArrivals(arrivalsResult.value.products);
    if (categoriesResult.status === "rejected" && arrivalsResult.status === "rejected") {
      setError(true);
    }
  }, []);

  useEffect(() => {
    // Standard fetch-on-mount - runs once, not a cascading-render loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <FlatList
        data={newArrivals}
        keyExtractor={(item) => item.productCode}
        numColumns={2}
        columnWrapperStyle={{ gap: 16, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#151210" />}
        ListHeaderComponent={
          <View className="gap-6 pb-2">
            <View className="gap-1 px-4 pt-2">
              <Text className="text-display text-ink-950">Bawi</Text>
              <Text className="text-body text-ink-500">Fashion, from independent brands.</Text>
            </View>

            {categories.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={categories}
                keyExtractor={(c) => c.id}
                contentContainerClassName="gap-2 px-4"
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: "/(tabs)/search", params: { category: item.id, categoryName: item.name } })}
                    className="rounded-full border border-ink-200 bg-white px-4 py-2 active:bg-ink-100"
                  >
                    <Text className="text-body-sm text-ink-800">{item.name}</Text>
                  </Pressable>
                )}
              />
            ) : null}

            <Text className="px-4 text-h3 text-ink-950">New arrivals</Text>

            {error ? (
              <View className="px-4">
                <Text className="text-body-sm text-ink-500">
                  Couldn&apos;t load products right now. Pull down to try again.
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-1">
            <ProductCard
              product={toProductCardData(item)}
              onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}
