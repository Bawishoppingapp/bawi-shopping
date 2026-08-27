import { Button, StatusBadge, ThemedActivityIndicator } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { formatMoney } from "@/features/discovery/utils/format-price";
import { type OrderSummary, listOrders } from "@/features/orders/services/orders-client";
import { orderStatusBadge } from "@/features/orders/utils/order-status";

export default function OrdersScreen() {
  const { customer, isLoading: authLoading } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
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
        <Stack.Screen options={{ headerShown: true, title: "Orders" }} />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-body text-ink-500">Log in to see your orders.</Text>
          <Button onPress={() => router.push("/login")}>Log in</Button>
        </View>
      </SafeAreaView>
    );
  }

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ headerShown: true, title: "Orders" }} />
        <ThemedActivityIndicator />
      </SafeAreaView>
    );
  }

  if (orders.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <Stack.Screen options={{ headerShown: true, title: "Orders" }} />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-h2 text-ink-950">No orders yet</Text>
          <Button onPress={() => router.push("/(tabs)")}>Start browsing</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Orders" }} />
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#151210" />}
        renderItem={({ item }) => {
          const badge = orderStatusBadge(item.status);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })}
              className="gap-2 rounded-md border border-ink-100 p-4 active:bg-ink-100"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-body-sm font-medium text-ink-950">Order {item.display_id}</Text>
                <StatusBadge label={badge.label} tone={badge.tone} />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-caption text-ink-500">
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
                <Text className="text-body-sm text-ink-950">{formatMoney(item.total, item.currency_code)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
