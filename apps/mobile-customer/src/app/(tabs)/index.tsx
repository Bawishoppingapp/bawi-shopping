import { ProductCardSkeleton, ThemedIcon } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { type CategoryNode, type ProductHit, listCategories, searchProducts } from "@/features/discovery/services/discovery-client";
import { getRecentlyViewed } from "@/features/discovery/services/recently-viewed";
import { formatMoney } from "@/features/discovery/utils/format-price";
import { CategoryStrip } from "@/features/home/components/CategoryStrip";
import { EditorialSpotlight } from "@/features/home/components/EditorialSpotlight";
import { HeroBanner } from "@/features/home/components/HeroBanner";
import { MasonryGrid } from "@/features/home/components/MasonryGrid";
import { ProductRail } from "@/features/home/components/ProductRail";
import { PromoBanner } from "@/features/home/components/PromoBanner";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";
import { listNotifications } from "@/features/notifications/services/notifications-client";
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
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductHit[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ProductHit[]>([]);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Recently-viewed is local-device state (not tied to the discovery
  // fetch below), so it refreshes on every focus rather than only on
  // mount/refresh - visiting a product and coming back should show it
  // immediately without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      getRecentlyViewed().then(setRecentlyViewed);
    }, [])
  );

  // Refetched on every focus (not just mount) so the badge clears
  // promptly after visiting Account -> Notifications.
  useFocusEffect(
    useCallback(() => {
      if (!customer) {
        setUnreadCount(0);
        return;
      }
      (async () => {
        const token = await getSessionToken();
        const notifications = await listNotifications(token);
        setUnreadCount(notifications.filter((n) => !n.read_at).length);
      })();
    }, [customer])
  );

  const load = useCallback(async () => {
    setError(false);
    const [categoriesResult, arrivalsResult, shippingResult] = await Promise.allSettled([
      listCategories(locale),
      searchProducts({ sort: "newest", limit: NEW_ARRIVALS_LIMIT, locale }),
      getShippingPolicy(CURRENCY_CODE),
    ]);
    if (categoriesResult.status === "fulfilled") setCategories(categoriesResult.value);
    if (arrivalsResult.status === "fulfilled") setNewArrivals(arrivalsResult.value.products);
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
  const gridProducts = newArrivals.slice(SPOTLIGHT_COUNT);

  // A plain array, not a switch/registry - reordering or dropping a
  // section on Home is just reordering or deleting an entry here. Each
  // section is its own component so this list stays readable as a table
  // of contents for the page rather than a wall of JSX.
  const sections = useMemo(
    () => [
      {
        key: "hero",
        node: (
          <HeroBanner
            eyebrow="NEW ARRIVALS WEEKLY"
            headline="Fashion, From Independent Hands"
            body="Discover boutique labels and independent designers, curated in one closet."
            ctaLabel="Shop new arrivals"
            ctaHref={{ pathname: "/(tabs)/search", params: { sort: "newest" } }}
          />
        ),
      },
      {
        key: "categories",
        node: categories.length > 0 ? <CategoryStrip categories={categories} /> : null,
      },
      {
        key: "recently-viewed",
        node:
          recentlyViewed.length > 0 ? (
            <ProductRail title="Recently viewed" products={recentlyViewed} />
          ) : null,
      },
      {
        key: "spotlight",
        node:
          spotlightProducts.length === SPOTLIGHT_COUNT ? (
            <EditorialSpotlight
              title="Just In"
              subtitle="Fresh from this week's drops"
              products={spotlightProducts as [ProductHit, ProductHit, ProductHit]}
            />
          ) : null,
      },
      {
        key: "promo",
        node:
          freeShippingThreshold !== null ? (
            <PromoBanner
              title={`Free shipping over ${formatMoney(freeShippingThreshold, CURRENCY_CODE)}`}
              body="Applied automatically at checkout - no code needed."
            />
          ) : null,
      },
      {
        key: "grid",
        node:
          gridProducts.length > 0 ? (
            <MasonryGrid
              title={t("home.newArrivals")}
              subtitle="The latest, all in one place"
              products={gridProducts}
              seeAllHref="/(tabs)/search"
            />
          ) : null,
      },
    ],
    [categories, recentlyViewed, spotlightProducts, gridProducts, freeShippingThreshold, t]
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
            <View className="gap-1">
              <Text className="font-serif text-display text-ink-950">
                {customer?.first_name ? `Welcome, ${customer.first_name}` : "Bawi"}
              </Text>
              <Text className="text-body text-ink-500">Fashion, from independent brands.</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change language"
                onPress={() => router.push("/(tabs)/account/language")}
                className="h-10 w-10 items-center justify-center rounded-full bg-ink-100 active:bg-ink-200"
              >
                <ThemedIcon name="language-outline" size={20} />
              </Pressable>
              {customer ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                  onPress={() => router.push("/(tabs)/account/notifications")}
                  className="h-10 w-10 items-center justify-center rounded-full bg-ink-100 active:bg-ink-200"
                >
                  <View>
                    <ThemedIcon name="notifications-outline" size={20} />
                    {unreadCount > 0 ? (
                      <View className="absolute -right-1.5 -top-1.5 h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1">
                        <Text className="text-[10px] font-medium text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sell on Bawi"
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
              Couldn&apos;t load products right now. Pull down to try again.
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
