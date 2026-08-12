import { StatusBadge } from "@bawi/mobile-ui";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, Text, View } from "react-native";

import { getSessionToken } from "@/features/auth/services/token-storage";
import { type FulfillmentOrder, listFulfillmentOrders } from "@/features/fulfillment/services/fulfillment-client";
import { fulfillmentStatusBadge } from "@/features/fulfillment/utils/status";
import { formatUsd } from "@/utils/format-price";

export default function FulfillmentScreen() {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getSessionToken();
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
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  if (orders.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-h2 text-ink-950">No orders yet</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#151210" />}
        ListHeaderComponent={<Text className="mb-2 text-h1 text-ink-950">Fulfillment</Text>}
        renderItem={({ item }) => {
          const badge = fulfillmentStatusBadge(item.status);
          const itemCount = item.items.reduce((sum, i) => sum + i.quantity, 0);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/fulfillment/[id]", params: { id: item.id } })}
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
