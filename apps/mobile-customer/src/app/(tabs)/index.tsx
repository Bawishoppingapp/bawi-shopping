import { ProductCard, ProductCardSkeleton } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, SafeAreaView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { type CategoryNode, type ProductHit, listCategories, searchProducts } from "@/features/discovery/services/discovery-client";
import { getRecentlyViewed } from "@/features/discovery/services/recently-viewed";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";
import { listNotifications } from "@/features/notifications/services/notifications-client";

const NEW_ARRIVALS_LIMIT = 12;

export default function HomeScreen() {
  const { customer } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const locale = useLocale();
  const t = useTranslations();
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [newArrivals, setNewArrivals] = useState<ProductHit[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ProductHit[]>([]);
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
    const [categoriesResult, arrivalsResult] = await Promise.allSettled([
      listCategories(locale),
      searchProducts({ sort: "newest", limit: NEW_ARRIVALS_LIMIT, locale }),
    ]);
    if (categoriesResult.status === "fulfilled") setCategories(categoriesResult.value);
    if (arrivalsResult.status === "fulfilled") setNewArrivals(arrivalsResult.value.products);
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
      <FlatList
        data={newArrivals}
        keyExtractor={(item) => item.productCode}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 8, paddingBottom: tabBarHeight + 24 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <View className="gap-7 pb-4">
            <View className="gap-5 border-b border-ink-100 px-4 pb-5 pt-3">
              <View className="flex-row items-center justify-between">
                <View className="gap-1">
                  <Text className="text-display text-ink-950">
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
                    <Ionicons name="language-outline" size={20} color="#151210" />
                  </Pressable>
                  {customer ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                      onPress={() => router.push("/(tabs)/account/notifications")}
                      className="h-10 w-10 items-center justify-center rounded-full bg-ink-100 active:bg-ink-200"
                    >
                      <View>
                        <Ionicons name="notifications-outline" size={20} color="#151210" />
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
                    <Ionicons name="storefront-outline" size={20} color="#151210" />
                  </Pressable>
                </View>
              </View>

              {categories.length > 0 ? (
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={categories}
                  keyExtractor={(c) => c.id}
                  contentContainerClassName="gap-2.5"
                  renderItem={({ item }) => (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: "/(tabs)/search", params: { category: item.id, categoryName: item.name } })}
                      className="rounded-full bg-white px-4 py-2.5 shadow-sm active:bg-ink-100"
                      style={{
                        shadowColor: "#151210",
                        shadowOpacity: 0.08,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2,
                      }}
                    >
                      <Text className="text-body-sm font-medium text-ink-800">{item.name}</Text>
                    </Pressable>
                  )}
                />
              ) : null}
            </View>

            {recentlyViewed.length > 0 ? (
              <View className="gap-3">
                <Text className="px-4 text-h3 text-ink-950">Recently viewed</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={recentlyViewed}
                  keyExtractor={(item) => item.productCode}
                  contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
                  renderItem={({ item }) => (
                    <View style={{ width: 128 }}>
                      <ProductCard
                        product={toProductCardData(item)}
                        onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })}
                      />
                    </View>
                  )}
                />
              </View>
            ) : null}

            <View className="flex-row items-center justify-between px-4">
              <Text className="text-h3 text-ink-950">{t("home.newArrivals")}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/search")}>
                <Text className="text-body-sm font-medium text-gold-600">See all</Text>
              </Pressable>
            </View>

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
          <View className="flex-1 px-2 pb-4">
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
