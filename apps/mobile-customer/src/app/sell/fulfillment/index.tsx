import { StatusBadge } from "@bawi/mobile-ui";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, Text, View } from "react-native";

import { formatUsd } from "@/features/discovery/utils/format-price";
import { type FulfillmentOrder, listFulfillmentOrders } from "@/features/fulfillment/services/fulfillment-client";
import { fulfillmentStatusBadge } from "@/features/fulfillment/utils/status";
import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";

export default function SellFulfillmentScreen() {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getSellerSessionToken();
    if (!token) return;
    const result = await listFulfillmentOrders(token);
    setOrders(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ headerShown: true, title: "Fulfillment" }} />
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  if (orders.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <Stack.Screen options={{ headerShown: true, title: "Fulfillment" }} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-h2 text-ink-950">No orders yet</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Fulfillment" }} />
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#151210" />}
        renderItem={({ item }) => {
          const badge = fulfillmentStatusBadge(item.status);
          const itemCount = item.items.reduce((sum, i) => sum + i.quantity, 0);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/sell/fulfillment/[id]", params: { id: item.id } })}
              className="gap-2 rounded-md border border-ink-100 p-4 active:bg-ink-100"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-body-sm font-medium text-ink-950">{item.fulfillment_code}</Text>
                <StatusBadge label={badge.label} tone={badge.tone} />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-caption text-ink-500">
                  {itemCount} item{itemCount === 1 ? "" : "s"} · due{" "}
                  {new Date(item.fulfillment_deadline_at).toLocaleDateString()}
                </Text>
                <Text className="text-body-sm text-ink-950">{formatUsd(item.total)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
