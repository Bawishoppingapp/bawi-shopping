import { ProductCardSkeleton, ThemedIcon } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { type CategoryNode, type ProductHit, listCategories, searchProducts } from "@/features/discovery/services/discovery-client";
import { clearRecentlyViewed, getRecentlyViewed } from "@/features/discovery/services/recently-viewed";
import { useCurrency } from "@/features/currency/hooks/use-currency";
import { HeroBanner } from "@/features/home/components/HeroBanner";
import { CategoryStrip } from "@/features/home/components/CategoryStrip";
import { EditorialSpotlight } from "@/features/home/components/EditorialSpotlight";
import { MasonryGrid } from "@/features/home/components/MasonryGrid";
import { ProductCatalogPlaceholder } from "@/features/home/components/ProductCatalogPlaceholder";
import { ProductRail } from "@/features/home/components/ProductRail";
import { PromoBanner } from "@/features/home/components/PromoBanner";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";
import { getShippingPolicy } from "@/features/shipping-policy/services/shipping-policy-client";

const NEW_ARRIVALS_LIMIT = 15;
const SPOTLIGHT_COUNT = 3;
// The app is ETB-only for now (see CLAUDE.md's "Currency and market") -
// this becomes a real per-customer/per-seller value again once USD comes
// back into the mobile app.
const CURRENCY_CODE = "etb";

export default function HomeScreen() {
  const { customer } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const locale = useLocale();
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductHit[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ProductHit[]>([]);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalogResolved, setCatalogResolved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  // Recently-viewed is local-device state (not tied to the discovery
  // fetch below), so it refreshes on every focus rather than only on
  // mount/refresh - visiting a product and coming back should show it
  // immediately without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getRecentlyViewed(locale).then((items) => { if (active) setRecentlyViewed(items); }).catch(() => {});
      return () => { active = false; };
    }, [locale])
  );

  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setError(false);
    const [categoriesResult, arrivalsResult, shippingResult] = await Promise.allSettled([
      listCategories(locale),
      searchProducts({ sort: "newest", limit: NEW_ARRIVALS_LIMIT, locale }),
      getShippingPolicy(CURRENCY_CODE),
    ]);
    if (version !== loadVersion.current) return;
    if (categoriesResult.status === "fulfilled") setCategories(categoriesResult.value);
    if (arrivalsResult.status === "fulfilled") {
      setCatalogResolved(true);
      setNewArrivals(arrivalsResult.value.products);
      // An empty first page means the public catalog has no approved
      // products. Remove device-local cards from an older catalog state so
      // they cannot navigate to detail routes that now correctly return 404.
      if (arrivalsResult.value.products.length === 0) {
        await clearRecentlyViewed();
        setRecentlyViewed([]);
      }
    } else {
      setCatalogResolved(false);
    }
    if (shippingResult.status === "fulfilled" && shippingResult.value) {
      setFreeShippingThreshold(shippingResult.value.freeShippingThresholdCents);
    }
    if (categoriesResult.status === "rejected" && arrivalsResult.status === "rejected") {
      setError(true);
    }
  }, [locale]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const spotlightProducts = newArrivals.slice(0, SPOTLIGHT_COUNT);
  const gridProducts = newArrivals.length >= SPOTLIGHT_COUNT ? newArrivals.slice(SPOTLIGHT_COUNT) : newArrivals;

  // A plain array, not a switch/registry - reordering or dropping a
  // section on Home is just reordering or deleting an entry here. Each
  // section is its own component so this list stays readable as a table
  // of contents for the page rather than a wall of JSX.
  const sections = useMemo(
    () => [
      {
        key: "cover",
        node: <HeroBanner imageUri={newArrivals[0]?.thumbnail} eyebrow="Bawi" headline={t("home.hero.title")} body={t("home.hero.subtitle")} ctaLabel={t("home.hero.cta")} ctaHref="/(tabs)/search" />,
      },
      {
        key: "categories",
        node: categories.length > 0 ? <CategoryStrip categories={categories} /> : null,
      },
      {
        key: "recently-viewed",
        node:
          recentlyViewed.length > 0 ? (
            <ProductRail title={t("home.recentlyViewed")} products={recentlyViewed} />
          ) : null,
      },
      {
        key: "spotlight",
        node:
          spotlightProducts.length === SPOTLIGHT_COUNT ? (
            <EditorialSpotlight
              title={t("home.justIn")}
              subtitle={t("home.justInSubtitle")}
              products={spotlightProducts as [ProductHit, ProductHit, ProductHit]}
            />
          ) : null,
      },
      {
        key: "promo",
        node:
          freeShippingThreshold !== null ? (
            <PromoBanner
              title={t("home.promoTitle", {
                amount: formatPrice(freeShippingThreshold, CURRENCY_CODE),
              })}
              body={t("home.promoBody")}
            />
          ) : null,
      },
      {
        key: "catalog-placeholder",
        node: catalogResolved && newArrivals.length === 0 ? <ProductCatalogPlaceholder /> : null,
      },
      {
        key: "grid",
        node:
          gridProducts.length > 0 ? (
            <MasonryGrid
              title={t("home.newArrivals")}
              subtitle={t("home.gridSubtitle")}
              products={gridProducts}
              seeAllHref="/(tabs)/search"
            />
          ) : null,
      },
    ],
    [categories, recentlyViewed, spotlightProducts, gridProducts, catalogResolved, newArrivals, freeShippingThreshold, t, formatPrice]
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-row flex-wrap px-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={{ width: "50%" }} className="px-2 pb-4">
              <ProductCardSkeleton />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="gap-5 border-b border-ink-100 px-4 pb-5 pt-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-1 pr-3">
              <Text className="font-serif text-display text-ink-950">
                {customer?.first_name ? t("home.welcome", { name: customer.first_name }) : "Bawi"}
              </Text>
              <Text className="text-body text-ink-500">{t("home.tagline")}</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("home.sell")}
                onPress={() => router.push("/sell")}
                className="h-10 w-10 items-center justify-center rounded-full bg-ink-100 active:bg-ink-200"
              >
                <ThemedIcon name="storefront-outline" size={20} />
              </Pressable>
            </View>
          </View>
        </View>

        {error ? (
          <View className="px-4 pt-4">
            <Text className="text-body-sm text-ink-500">
              {t("home.loadError")}
            </Text>
          </View>
        ) : null}

        <View className="gap-8 pt-6">
          {sections.map(({ key, node }) => (node ? <View key={key}>{node}</View> : null))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
