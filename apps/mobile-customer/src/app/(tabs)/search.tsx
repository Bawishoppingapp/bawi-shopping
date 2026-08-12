import { DEFAULT_LOCALE } from "@bawi/i18n/locales";
import { ProductCard } from "@bawi/mobile-ui";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, SafeAreaView, Text, TextInput, View } from "react-native";

import {
  type ProductHit,
  type ProductSortOption,
  searchProducts,
} from "@/features/discovery/services/discovery-client";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";

const PAGE_SIZE = 20;

export default function SearchScreen() {
  const params = useLocalSearchParams<{ category?: string; categoryName?: string }>();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProductSortOption>("newest");
  const [items, setItems] = useState<ProductHit[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const runSearch = useCallback(
    async (opts: { reset: boolean; cursor?: string | null }) => {
      if (opts.reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const result = await searchProducts({
          q: query || undefined,
          category: params.category,
          sort,
          cursor: opts.cursor ?? undefined,
          limit: PAGE_SIZE,
          locale: DEFAULT_LOCALE,
        });
        setItems((prev) => (opts.reset ? result.products : [...prev, ...result.products]));
        setCursor(result.next_cursor);
        setHasMore(result.has_more);
      } catch {
        if (opts.reset) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, sort, params.category]
  );

  // Re-run on filter/sort change (including arriving here from a Home
  // category chip) - not on every keystroke, only when the query is
  // submitted (see TextInput onSubmitEditing below).
  useEffect(() => {
    runSearch({ reset: true });
    // runSearch intentionally omitted: it's rebuilt every render (closes
    // over `query`), including it would refetch on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, params.category]);

  function onLoadMore() {
    if (!hasMore || loadingMore || loading) return;
    runSearch({ reset: false, cursor });
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="gap-3 px-4 pb-3 pt-2">
        {params.categoryName ? (
          <Text className="text-h2 text-ink-950">{params.categoryName}</Text>
        ) : null}
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch({ reset: true })}
          placeholder="Search products"
          placeholderTextColor="#8C8175"
          returnKeyType="search"
          autoCapitalize="none"
          className="h-12 rounded-md border border-ink-200 bg-white px-3 text-body text-ink-950"
        />
        <View className="flex-row gap-2">
          {(
            [
              ["newest", "Newest"],
              ["price_asc", "Price: low to high"],
              ["price_desc", "Price: high to low"],
            ] as const
          ).map(([value, label]) => (
            <Text
              key={value}
              onPress={() => setSort(value)}
              className={`rounded-full border px-3 py-1.5 text-body-sm ${
                sort === value ? "border-ink-950 bg-ink-950 text-white" : "border-ink-200 text-ink-700"
              }`}
            >
              {label}
            </Text>
          ))}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#151210" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.productCode}
          numColumns={2}
          columnWrapperStyle={{ gap: 16, paddingHorizontal: 16 }}
          contentContainerStyle={{ gap: 16, paddingBottom: 32 }}
          onEndReachedThreshold={0.4}
          onEndReached={onLoadMore}
          ListEmptyComponent={
            <View className="items-center px-6 pt-16">
              <Text className="text-body text-ink-500">No products found.</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" color="#151210" /> : null}
          renderItem={({ item }) => (
            <View className="flex-1">
              <ProductCard
                product={toProductCardData(item)}
                onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
