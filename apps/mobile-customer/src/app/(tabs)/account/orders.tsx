import { Button, StatusBadge, ThemedActivityIndicator, useThemeColors } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { useCurrency } from "@/features/currency/hooks/use-currency";
import { type OrderSummary, listOrders } from "@/features/orders/services/orders-client";
import { orderStatusBadge } from "@/features/orders/utils/order-status";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";

export default function OrdersScreen() {
  const themeColors = useThemeColors();
  const { customer, isLoading: authLoading } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const locale = useLocale();
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getSessionToken();
    const result = await listOrders(token);
    setOrders(result);
  }, []);

  // Refetch on every focus, not just on mount - order status changes
  // server-side (seller/courier actions) between visits to this screen.
  useFocusEffect(
    useCallback(() => {
      if (authLoading || !customer) {
        setLoading(false);
        return;
      }
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [authLoading, customer, load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!authLoading && !customer) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <Stack.Screen options={{ headerShown: true, title: t("order.historyTitle") }} />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-body text-ink-500">{t("orders.loginHint")}</Text>
          <Button onPress={() => router.push("/login")}>{t("login.submit")}</Button>
        </View>
      </SafeAreaView>
    );
  }

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ headerShown: true, title: t("order.historyTitle") }} />
        <ThemedActivityIndicator />
      </SafeAreaView>
    );
  }

  if (orders.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <Stack.Screen options={{ headerShown: true, title: t("order.historyTitle") }} />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-h2 text-ink-950">{t("order.noOrders")}</Text>
          <Button onPress={() => router.push("/(tabs)")}>{t("orders.startBrowsing")}</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: t("order.historyTitle") }} />
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.ink950} />}
        renderItem={({ item }) => {
          const badge = orderStatusBadge(item.status, t);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
              className="gap-2 rounded-md border border-ink-100 p-4 active:bg-ink-100"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-body-sm font-medium text-ink-950">{t("order.number")} {item.display_id}</Text>
                <StatusBadge label={badge.label} tone={badge.tone} />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-caption text-ink-500">
                  {new Date(item.created_at).toLocaleDateString(locale)}
                </Text>
                <Text className="text-body-sm text-ink-950">{formatPrice(item.total, item.currency_code)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
