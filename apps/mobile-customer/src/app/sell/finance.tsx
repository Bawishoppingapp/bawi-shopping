import { StatusBadge } from "@bawi/mobile-ui";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, Text, View } from "react-native";

import { formatMoney } from "@/features/discovery/utils/format-price";
import { type Payout, type SellerBalance, getBalance, listPayouts } from "@/features/finance/services/finance-client";
import { payoutStatusBadge } from "@/features/finance/utils/status";
import { useSellerAuth } from "@/features/seller-auth/hooks/use-seller-auth";
import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";

const BUCKETS: { key: keyof SellerBalance; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "available", label: "Available" },
  { key: "paid", label: "Paid out" },
  { key: "disputed", label: "Disputed" },
];

export default function SellFinanceScreen() {
  const { seller } = useSellerAuth();
  const currencyCode = seller?.seller.currency_code ?? "usd";
  const [balance, setBalance] = useState<SellerBalance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getSellerSessionToken();
    if (!token) return;
    const [balanceResult, payoutsResult] = await Promise.allSettled([getBalance(token), listPayouts(token)]);
    if (balanceResult.status === "fulfilled") setBalance(balanceResult.value);
    if (payoutsResult.status === "fulfilled") setPayouts(payoutsResult.value);
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
        <Stack.Screen options={{ headerShown: true, title: "Finance" }} />
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Finance" }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#151210" />}
      >
        <View className="flex-row flex-wrap gap-3">
          {BUCKETS.map((bucket) => (
            <View key={bucket.key} className="min-w-[45%] flex-1 gap-1 rounded-md border border-ink-100 p-4">
              <Text className="text-caption uppercase tracking-wide text-ink-500">{bucket.label}</Text>
              <Text className="text-h2 text-ink-950">{formatMoney(balance?.[bucket.key] ?? 0, currencyCode)}</Text>
            </View>
          ))}
        </View>

        <View className="gap-3">
          <Text className="text-h3 text-ink-950">Payout history</Text>
          {payouts.length === 0 ? (
            <Text className="text-body-sm text-ink-500">No payouts yet.</Text>
          ) : (
            payouts.map((payout) => {
              const badge = payoutStatusBadge(payout.status);
              return (
                <View
                  key={payout.id}
                  className="flex-row items-center justify-between rounded-md border border-ink-100 p-4"
                >
                  <View className="gap-1">
                    <Text className="text-body-sm font-medium text-ink-950">{formatMoney(payout.amount, currencyCode)}</Text>
                    <Text className="text-caption text-ink-500">
                      {new Date(payout.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <StatusBadge label={badge.label} tone={badge.tone} />
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
