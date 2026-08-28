import { ProductCard, ProductCardSkeleton, ThemedActivityIndicator, ThemedIcon, useThemeColors } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { FlashList } from "@shopify/flash-list";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  type CategoryNode,
  type ProductHit,
  type ProductSearchFacets,
  type ProductSortOption,
  listCategories,
  searchProducts,
} from "@/features/discovery/services/discovery-client";
import { getRecentlyViewed } from "@/features/discovery/services/recently-viewed";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "@/features/search/services/search-history";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 400;

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`rounded-full border px-3 py-1.5 ${
        selected ? "border-ink-solid bg-ink-solid" : "border-ink-200 bg-surface"
      }`}
    >
      <Text className={`text-body-sm ${selected ? "text-white" : "text-ink-700"}`}>{label}</Text>
    </Pressable>
  );
}

export default function SearchScreen() {
  const params = useLocalSearchParams<{ category?: string; categoryName?: string }>();
  const tabBarHeight = useBottomTabBarHeight();
  const locale = useLocale();
  const t = useTranslations();
  const themeColors = useThemeColors();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sort, setSort] = useState<ProductSortOption>("newest");
  const [size, setSize] = useState<string | undefined>(undefined);
  const [color, setColor] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<ProductHit[]>([]);
  const [facets, setFacets] = useState<ProductSearchFacets>({ sizes: [], colors: [] });
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Discovery-state (shown before the user has typed/selected anything)
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductHit[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ProductHit[]>([]);

  const showDiscovery = debouncedQuery.trim().length === 0 && !params.category;

  // Debounce typed input into a live search - not on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const runSearch = useCallback(
    async (opts: { reset: boolean; cursor?: string | null }) => {
      if (opts.reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const result = await searchProducts({
          q: debouncedQuery || undefined,
          category: params.category,
          size,
          color,
          sort,
          cursor: opts.cursor ?? undefined,
          limit: PAGE_SIZE,
          locale,
        });
        setItems((prev) => (opts.reset ? result.products : [...prev, ...result.products]));
        setCursor(result.next_cursor);
        setHasMore(result.has_more);
        setFacets(result.facets);
      } catch {
        if (opts.reset) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQuery, sort, size, color, params.category, locale]
  );

  useEffect(() => {
    if (showDiscovery) return;
    runSearch({ reset: true });
    // runSearch intentionally omitted: rebuilt every render (closes over
    // filters), including it would refetch redundantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, sort, size, color, params.category, showDiscovery, locale]);

  // Record the submitted query once it actually produces a search, not
  // on every debounce tick - avoids polluting history with partial words.
  const lastRecordedQuery = useRef<string>("");
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed || trimmed === lastRecordedQuery.current) return;
    lastRecordedQuery.current = trimmed;
    addRecentSearch(trimmed);
  }, [debouncedQuery]);

  const loadDiscoveryData = useCallback(async () => {
    const [categoriesResult, arrivalsResult, recentResult, viewedResult] = await Promise.allSettled([
      listCategories(locale),
      searchProducts({ sort: "newest", limit: 12, locale }),
      getRecentSearches(),
      getRecentlyViewed(),
    ]);
    if (categoriesResult.status === "fulfilled") setCategories(categoriesResult.value);
    if (arrivalsResult.status === "fulfilled") setNewArrivals(arrivalsResult.value.products);
    if (recentResult.status === "fulfilled") setRecentSearches(recentResult.value);
    if (viewedResult.status === "fulfilled") setRecentlyViewed(viewedResult.value);
  }, [locale]);

  useFocusEffect(
    useCallback(() => {
      if (showDiscovery) loadDiscoveryData();
      // Only refresh discovery content when it's actually visible -
      // re-running on every focus keeps "recent searches"/"recently
      // viewed" fresh without an extra fetch while browsing results.
      // locale is a real dep here (not just showDiscovery) so a language
      // change re-fetches translated categories/new-arrivals immediately
      // rather than waiting for the next focus with a stale closure.
    }, [showDiscovery, loadDiscoveryData])
  );

  function onLoadMore() {
    if (!hasMore || loadingMore || loading) return;
    runSearch({ reset: false, cursor });
  }

  async function onClearRecentSearches() {
    await clearRecentSearches();
    setRecentSearches([]);
  }

  function goToProduct(code: string) {
    router.push({ pathname: "/product/[code]", params: { code } });
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="gap-3 px-4 pb-3 pt-2">
        {params.categoryName ? <Text className="text-h2 text-ink-950">{params.categoryName}</Text> : null}
        <View className="h-12 flex-row items-center rounded-md border border-ink-200 bg-surface px-3">
          <ThemedIcon name="search" size={18} tone="ink400" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("search.placeholder")}
            placeholderTextColor={themeColors.ink400}
            returnKeyType="search"
            autoCapitalize="none"
            className="ml-2 flex-1 text-body text-ink-950"
          />
          {query.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")}>
              <ThemedIcon name="close-circle" size={18} tone="ink400" />
            </Pressable>
          ) : null}
        </View>

        {!showDiscovery ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(
              [
                ["newest", "Newest"],
                ["price_asc", "Price: low to high"],
                ["price_desc", "Price: high to low"],
              ] as const
            ).map(([value, label]) => (
              <Chip key={value} label={label} selected={sort === value} onPress={() => setSort(value)} />
            ))}
            {facets.colors.map((c) => (
              <Chip key={c} label={c} selected={color === c} onPress={() => setColor(color === c ? undefined : c)} />
            ))}
            {facets.sizes.map((s) => (
              <Chip key={s} label={s} selected={size === s} onPress={() => setSize(size === s ? undefined : s)} />
            ))}
          </ScrollView>
        ) : null}
      </View>

      {showDiscovery ? (
        <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + 32 }} keyboardShouldPersistTaps="handled">
          {recentSearches.length > 0 ? (
            <View className="gap-2 px-4 pb-6">
              <View className="flex-row items-center justify-between">
                <Text className="text-h3 text-ink-950">Recent searches</Text>
                <Pressable accessibilityRole="button" onPress={onClearRecentSearches}>
                  <Text className="text-caption text-ink-500">Clear</Text>
                </Pressable>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {recentSearches.map((q) => (
                  <Chip key={q} label={q} selected={false} onPress={() => setQuery(q)} />
                ))}
              </View>
            </View>
          ) : null}

          {categories.length > 0 ? (
            <View className="gap-2 pb-6">
              <Text className="px-4 text-h3 text-ink-950">Browse categories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    onPress={() => router.setParams({ category: c.id, categoryName: c.name })}
                    className="rounded-full border border-ink-200 bg-surface px-4 py-2 active:bg-ink-100"
                  >
                    <Text className="text-body-sm text-ink-800">{c.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {recentlyViewed.length > 0 ? (
            <View className="gap-2 pb-6">
              <Text className="px-4 text-h3 text-ink-950">Recently viewed</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
                {recentlyViewed.map((item) => (
                  <View key={item.productCode} style={{ width: 120 }}>
                    <ProductCard product={toProductCardData(item)} onPress={() => goToProduct(item.productCode)} />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {newArrivals.length > 0 ? (
            <View className="gap-2">
              <Text className="px-4 text-h3 text-ink-950">New arrivals</Text>
              <View className="flex-row flex-wrap gap-4 px-4">
                {newArrivals.map((item) => (
                  <View key={item.productCode} style={{ width: "47%" }}>
                    <ProductCard product={toProductCardData(item)} onPress={() => goToProduct(item.productCode)} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : loading ? (
        <View className="flex-1 flex-row flex-wrap px-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ width: "50%" }} className="px-2 pb-4">
              <ProductCardSkeleton />
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.productCode}
          numColumns={2}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: tabBarHeight + 32 }}
          onEndReachedThreshold={0.4}
          onEndReached={onLoadMore}
          ListEmptyComponent={
            <View className="items-center gap-2 px-6 pt-16">
              <ThemedIcon name="search-outline" size={32} tone="ink400" />
              <Text className="text-h3 text-ink-950">{t("search.noResults")}</Text>
              <Text className="text-center text-body-sm text-ink-500">{t("search.noResultsHint")}</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ThemedActivityIndicator className="py-4" /> : null}
          renderItem={({ item }) => (
            <View className="flex-1 px-2 pb-4">
              <ProductCard product={toProductCardData(item)} onPress={() => goToProduct(item.productCode)} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
