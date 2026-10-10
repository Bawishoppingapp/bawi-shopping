import { ProductCard, ProductCardSkeleton, ThemedIcon } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { type ProductHit } from "@/features/discovery/services/discovery-client";
import { clearRecentlyViewed, getRecentlyViewed } from "@/features/discovery/services/recently-viewed";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { useCurrency } from "@/features/currency/hooks/use-currency";
import { CategoryStrip } from "@/features/home/components/CategoryStrip";
import { ProductCatalogPlaceholder } from "@/features/home/components/ProductCatalogPlaceholder";
import { ProductRail } from "@/features/home/components/ProductRail";
import { SectionHeader } from "@/features/home/components/SectionHeader";
import { useHomeCatalog } from "@/features/home/hooks/use-home-catalog";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";

export default function HomeScreen() {
  const { customer } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = (width - insets.left - insets.right - 32 - 12) / 2;
  const locale = useLocale();
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const { categories, catalog, error, refreshing, refresh } = useHomeCatalog(locale);
  const [recent, setRecent] = useState<{ locale: string; items: ProductHit[] }>({ locale, items: [] });
  const emptyCatalog = catalog?.products.length === 0;

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!emptyCatalog) {
      void getRecentlyViewed(locale).then((items) => {
        if (active) setRecent({ locale, items });
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [locale, emptyCatalog]));

  useEffect(() => {
    if (emptyCatalog) void clearRecentlyViewed().catch(() => {});
  }, [emptyCatalog]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top", "left", "right"]}>
      <FlatList
        data={catalog?.products ?? []}
        numColumns={2}
        keyExtractor={(item) => item.productCode}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={5}
        columnWrapperStyle={{ paddingHorizontal: 16, gap: 12 }}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={{ gap: 24, paddingBottom: 20 }}>
            <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
              <View className="flex-1 gap-1 pr-3">
                <Text className="font-serif text-h1 text-ink-950">
                  {customer?.first_name ? t("home.welcome", { name: customer.first_name }) : "Bawi"}
                </Text>
                <Text className="text-body-sm text-ink-500">{t("home.tagline")}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t("home.sell")}
                onPress={() => router.push("/sell")}
                className="h-11 w-11 items-center justify-center rounded-full bg-ink-100 active:bg-ink-200">
                <ThemedIcon name="storefront-outline" size={20} />
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t("nav.search")}
              onPress={() => router.push("/(tabs)/search")}
              className="mx-4 flex-row items-center gap-3 rounded-xl border border-ink-200 bg-surface px-4 py-3">
              <ThemedIcon name="search-outline" size={20} tone="ink500" />
              <Text className="text-body text-ink-500">{t("nav.search")}</Text>
            </Pressable>
            {categories && categories.length > 0 ? <CategoryStrip categories={categories} /> : null}
            {error ? <Text className="px-4 text-body-sm text-ink-500">{t("home.loadError")}</Text> : null}
            {!emptyCatalog ? <SectionHeader title={t("home.newArrivals")} seeAllHref="/(tabs)/search" /> : null}
          </View>
        }
        ListEmptyComponent={emptyCatalog ? <ProductCatalogPlaceholder /> : !catalog && !error ? (
          <View className="flex-row px-4" style={{ gap: 12 }}>
            <View className="flex-1"><ProductCardSkeleton /></View>
            <View className="flex-1"><ProductCardSkeleton /></View>
          </View>
        ) : null}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth, paddingBottom: 20 }}>
            <ProductCard product={toProductCardData(item, t, formatPrice)} imageAspectRatio={0.8}
              onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })} />
          </View>
        )}
        ListFooterComponent={!emptyCatalog && recent.locale === locale && recent.items.length > 0 ? (
          <View className="pt-4"><ProductRail title={t("home.recentlyViewed")} products={recent.items} /></View>
        ) : null}
      />
    </SafeAreaView>
  );
}
