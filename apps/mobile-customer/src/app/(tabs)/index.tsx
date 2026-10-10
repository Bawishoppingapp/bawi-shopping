import { ProductCardSkeleton, ThemedIcon } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, InteractionManager, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { CategoryNode, ProductHit } from "@/features/discovery/services/discovery-client";
import { clearRecentlyViewed, getRecentlyViewed } from "@/features/discovery/services/recently-viewed";
import { CategoryStrip } from "@/features/home/components/CategoryStrip";
import { EditorialSpotlight } from "@/features/home/components/EditorialSpotlight";
import { HeroBanner } from "@/features/home/components/HeroBanner";
import { ProductCatalogPlaceholder } from "@/features/home/components/ProductCatalogPlaceholder";
import { ProductGrid } from "@/features/home/components/ProductGrid";
import { ProductRail } from "@/features/home/components/ProductRail";
import { useHomeCatalog } from "@/features/home/hooks/use-home-catalog";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";

type HomeSection =
  | { key: "hero"; kind: "hero"; product: ProductHit }
  | { key: "categories"; kind: "categories"; categories: CategoryNode[]; products: ProductHit[] }
  | { key: "new"; kind: "new"; products: ProductHit[] }
  | { key: "editorial"; kind: "editorial"; products: [ProductHit, ProductHit, ProductHit] }
  | { key: "more"; kind: "more"; products: ProductHit[] }
  | { key: "recent"; kind: "recent"; products: ProductHit[] }
  | { key: "empty"; kind: "empty" }
  | { key: "loading"; kind: "loading" }
  | { key: "error"; kind: "error" };

export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const locale = useLocale();
  const t = useTranslations();
  const { categories, catalog, error, refreshing, refresh } = useHomeCatalog(locale);
  const [recent, setRecent] = useState<{ locale: string; items: ProductHit[] }>({ locale, items: [] });
  const emptyCatalog = catalog?.products.length === 0;

  useFocusEffect(useCallback(() => {
    let active = true;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!emptyCatalog) {
        void getRecentlyViewed(locale).then((items) => {
          if (active) setRecent({ locale, items });
        }).catch(() => {});
      }
    });
    return () => {
      active = false;
      task.cancel();
    };
  }, [locale, emptyCatalog]));

  useEffect(() => {
    if (emptyCatalog) void clearRecentlyViewed().catch(() => {});
  }, [emptyCatalog]);

  const sections = useMemo<HomeSection[]>(() => {
    const products = catalog?.products ?? [];
    if (products.length === 0) {
      const waiting: HomeSection[] = [];
      if (categories?.length) waiting.push({ key: "categories", kind: "categories", categories, products: [] });
      waiting.push(catalog ? { key: "empty", kind: "empty" } : error ? { key: "error", kind: "error" } : { key: "loading", kind: "loading" });
      return waiting;
    }

    const hero = products.find((product) => product.thumbnail);
    const ordered = hero ? [hero, ...products.filter((product) => product.productCode !== hero.productCode)] : products;
    const next: HomeSection[] = hero ? [{ key: "hero", kind: "hero", product: hero }] : [];

    if (categories?.length) next.push({ key: "categories", kind: "categories", categories, products: ordered });

    const arrivalsEnd = hero ? 8 : 7;
    const arrivals = ordered.slice(hero ? 1 : 0, arrivalsEnd);
    if (arrivals.length) next.push({ key: "new", kind: "new", products: arrivals });

    const editorial = ordered.slice(arrivalsEnd, arrivalsEnd + 3);
    const hasEditorial = editorial.length === 3 && editorial.every((product) => product.thumbnail);
    if (hasEditorial) {
      next.push({ key: "editorial", kind: "editorial", products: editorial as [ProductHit, ProductHit, ProductHit] });
    }

    const more = ordered.slice(hasEditorial ? arrivalsEnd + 3 : arrivalsEnd, 16);
    if (more.length) next.push({ key: "more", kind: "more", products: more });

    if (recent.locale === locale && recent.items.length) {
      next.push({ key: "recent", kind: "recent", products: recent.items });
    }
    return next;
  }, [catalog, categories, error, locale, recent]);

  const renderSection = useCallback(({ item }: { item: HomeSection }) => {
    switch (item.kind) {
      case "hero":
        return (
          <HeroBanner
            imageUri={item.product.thumbnail}
            eyebrow={t("home.justIn")}
            headline={t("home.hero.title")}
            body={t("home.hero.subtitle")}
            ctaLabel={t("home.hero.cta")}
            ctaHref="/(tabs)/search"
          />
        );
      case "categories":
        return <CategoryStrip categories={item.categories} products={item.products} />;
      case "new":
        return <ProductRail title={t("home.newArrivals")} subtitle={t("home.justInSubtitle")} products={item.products} seeAllHref="/(tabs)/search" />;
      case "editorial":
        return <EditorialSpotlight title={t("home.trendingNow")} subtitle={t("home.trendingSubtitle")} products={item.products} />;
      case "more":
        return <ProductGrid title={t("home.moreToExplore")} subtitle={t("home.gridSubtitle")} products={item.products} seeAllHref="/(tabs)/search" />;
      case "recent":
        return <ProductRail title={t("home.recentlyViewed")} products={item.products} />;
      case "empty":
        return <ProductCatalogPlaceholder />;
      case "loading":
        return (
          <View className="flex-row px-4 pt-3" style={{ gap: 12 }}>
            <View className="flex-1"><ProductCardSkeleton /></View>
            <View className="flex-1"><ProductCardSkeleton /></View>
          </View>
        );
      case "error":
        return <Text className="px-4 pt-3 text-body-sm text-ink-500">{t("home.loadError")}</Text>;
    }
  }, [t]);

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={["top", "left", "right"]}>
      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        renderItem={renderSection}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        contentContainerStyle={{ gap: 34, paddingBottom: tabBarHeight + 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="flex-row items-center justify-between px-4 pb-1 pt-3">
            <View className="flex-1 gap-0.5 pr-3">
              <Text className="font-serif text-display text-ink-950">Bawi</Text>
              <Text className="text-body-sm text-ink-500">{t("home.tagline")}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("home.sell")}
              onPress={() => router.push("/sell")}
              className="h-11 w-11 items-center justify-center rounded-full border border-ink-200 bg-surface active:bg-ink-100"
            >
              <ThemedIcon name="storefront-outline" size={20} />
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}
