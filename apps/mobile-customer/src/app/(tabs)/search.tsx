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
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { useCurrency } from "@/features/currency/hooks/use-currency";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";
import { addRecentSearch, clearRecentSearches, getRecentSearches } from "@/features/search/services/search-history";
import { EditorialEmptyState } from "@/components/EditorialEmptyState";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 400;
const AUDIENCE_CATEGORY_ORDER = ["Women", "Young Women", "Kids", "Sports", "Men"];
const SHOP_CATEGORY_ORDER = [
  "New In",
  "Clothing",
  "Formal Shop",
  "Habesha Wear",
  "Dresses",
  "Jumpsuits",
  "Tops",
  "Graphics",
  "Jackets & Sweaters",
  "Jeans",
  "Pants",
  "Bottoms",
  "Matching Sets",
  "Shoes",
  "Bags",
  "Accessories",
  "Lingerie & Sleep",
  "Beauty",
  "Women",
  "Young Women",
  "Men",
  "Kids",
  "Sports",
  "Shirts",
  "Sweatshirts",
];

function orderCategories(categories: CategoryNode[], preferredOrder: string[]) {
  const order = new Map(preferredOrder.map((name, index) => [name.toLowerCase(), index]));
  return [...categories].sort((a, b) => {
    const aIndex = order.get(a.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = order.get(b.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex || a.name.localeCompare(b.name);
  });
}

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
  const { formatPrice } = useCurrency();
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
  const [categorySnapshot, setCategorySnapshot] = useState<{ locale: string; items: CategoryNode[] }>({ locale, items: [] });
  const categories = categorySnapshot.locale === locale ? categorySnapshot.items : [];
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [categoryTitle, setCategoryTitle] = useState("");
  useEffect(() => {
    let active = true;
    setCategoryTitle("");
    if (params.category) listCategories(locale).then((nodes) => {
      const find = (items: CategoryNode[]): string | undefined => {
        for (const item of items) { if (item.id === params.category) return item.name; const nested = find(item.children); if (nested) return nested; }
      };
      if (active) setCategoryTitle(find(nodes) ?? "");
    }).catch(() => {});
    return () => { active = false; };
  }, [params.category, locale]);
  const showDiscovery = debouncedQuery.trim().length === 0 && !params.category;

  // Debounce typed input into a live search - not on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const searchVersion = useRef(0);
  const runSearch = useCallback(
    async (opts: { reset: boolean; cursor?: string | null }) => {
      const version = ++searchVersion.current;
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
        if (version !== searchVersion.current) return;
        setItems((prev) => (opts.reset ? result.products : [...prev, ...result.products]));
        setCursor(result.next_cursor);
        setHasMore(result.has_more);
        setFacets(result.facets);
      } catch {
        if (version === searchVersion.current && opts.reset) setItems([]);
      } finally {
        if (version === searchVersion.current) { setLoading(false); setLoadingMore(false); }
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

  useFocusEffect(
    useCallback(() => {
      if (!showDiscovery) return;
      let active = true;
      // Categories are shared with Home and cached by language. Local search
      // history still refreshes on focus; neither read waits for the other.
      void listCategories(locale).then((items) => {
        if (active) setCategorySnapshot({ locale, items });
      }).catch(() => {});
      void getRecentSearches().then((items) => {
        if (active) setRecentSearches(items);
      }).catch(() => {});
      return () => { active = false; };
    }, [showDiscovery, locale])
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

  const topCategories = AUDIENCE_CATEGORY_ORDER
    .map((name) => categories.find((category) => category.name.toLowerCase() === name.toLowerCase()))
    .filter((category): category is CategoryNode => Boolean(category));
  const browseCategories = orderCategories(categories, SHOP_CATEGORY_ORDER);

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="bg-paper">
        <View className="px-4 pb-5 pt-3">
          <Text className="font-serif text-display text-ink-950">{t("search.shop")}</Text>
        </View>

        {showDiscovery && topCategories.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 24 }}
          >
            {topCategories.map((category) => (
              <Pressable
                key={category.id}
                accessibilityRole="button"
                onPress={() => router.setParams({ category: category.id, categoryName: category.name })}
                className="border-b border-ink-200 pb-4 pt-1"
              >
                <Text className="text-caption font-medium uppercase tracking-widest text-ink-950">
                  {category.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : categoryTitle ? (
          <View className="px-4 pb-3">
            <Text className="text-h2 text-ink-950">{categoryTitle}</Text>
          </View>
        ) : null}
      </View>

      <View className="gap-3 border-b border-ink-100 px-4 pb-5 pt-3">
        <View className="h-14 flex-row items-center border border-ink-200 bg-surface px-4">
          <ThemedIcon name="search" size={18} tone="ink400" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("search.placeholder")}
            placeholderTextColor={themeColors.ink400}
            returnKeyType="search"
            autoCapitalize="none"
            className="ml-3 flex-1 text-body text-ink-950"
          />
          {query.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t("search.clearSearch")} onPress={() => setQuery("")}>
              <ThemedIcon name="close-circle" size={18} tone="ink400" />
            </Pressable>
          ) : null}
        </View>

        {!showDiscovery ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(
              [
                ["newest", t("sort.newest")],
                ["price_asc", t("sort.priceAsc")],
                ["price_desc", t("sort.priceDesc")],
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
            <View className="gap-3 border-b border-ink-100 px-4 py-6">
              <View className="flex-row items-center justify-between">
                <Text className="font-serif text-h2 text-ink-950">{t("search.recentSearches")}</Text>
                <Pressable accessibilityRole="button" onPress={onClearRecentSearches}>
                  <Text className="text-caption text-ink-500">{t("common.clear")}</Text>
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
            <View>
              <View className="px-4 pb-3 pt-8">
                <Text className="text-caption font-semibold uppercase tracking-widest text-ink-500">
                  {t("search.browseCategories")}
                </Text>
              </View>
              {browseCategories.map((category, index) => (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  onPress={() => router.setParams({ category: category.id, categoryName: category.name })}
                  className="mx-4 min-h-20 flex-row items-center border-b border-ink-200 py-4 active:bg-ink-100"
                >
                  <Text className="mr-5 text-caption tracking-widest text-ink-400">{String(index + 1).padStart(2, "0")}</Text>
                  <Text className="flex-1 font-serif text-h2 text-ink-950">
                    {category.name}
                  </Text>
                  <ThemedIcon name="arrow-forward" size={18} tone="ink700" />
                </Pressable>
              ))}
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
          ListEmptyComponent={<EditorialEmptyState icon="search-outline" title={t("search.noResults")} description={t("search.noResultsHint")} />}
          ListFooterComponent={loadingMore ? <ThemedActivityIndicator className="py-4" /> : null}
          renderItem={({ item }) => (
            <View className="flex-1 px-2 pb-4">
              <ProductCard product={toProductCardData(item, t, formatPrice)} onPress={() => goToProduct(item.productCode)} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
