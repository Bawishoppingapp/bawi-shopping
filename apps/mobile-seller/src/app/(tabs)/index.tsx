import { Button, StatusBadge } from "@bawi/mobile-ui";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { listFulfillmentOrders } from "@/features/fulfillment/services/fulfillment-client";
import { listReturnRequests } from "@/features/returns/services/returns-client";

export default function DashboardScreen() {
  const { seller, logout } = useAuth();
  const [awaitingPreparation, setAwaitingPreparation] = useState<number | null>(null);
  const [pendingReturns, setPendingReturns] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const token = await getSessionToken();
        if (!token) return;
        const [fulfillmentResult, returnsResult] = await Promise.allSettled([
          listFulfillmentOrders(token),
          listReturnRequests(token),
        ]);
        if (fulfillmentResult.status === "fulfilled") {
          setAwaitingPreparation(
            fulfillmentResult.value.filter((o) => o.status === "awaiting_preparation").length
          );
        }
        if (returnsResult.status === "fulfilled") {
          setPendingReturns(returnsResult.value.filter((r) => r.status === "requested").length);
        }
      })();
    }, [])
  );

  if (!seller) return null;

  const stripeReady = seller.seller.stripe.charges_enabled && seller.seller.stripe.payouts_enabled;

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View className="gap-1">
          <Text className="text-caption uppercase tracking-wide text-ink-500">Signed in as</Text>
          <Text className="text-h1 text-ink-950">{seller.seller.name}</Text>
        </View>

        <View className="gap-2 rounded-md border border-ink-100 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-body-sm font-medium text-ink-950">Stripe payouts</Text>
            <StatusBadge
              label={stripeReady ? "Ready" : "Setup needed"}
              tone={stripeReady ? "success" : "warning"}
            />
          </View>
          {!stripeReady ? (
            <Text className="text-body-sm text-ink-500">
              Finish connecting Stripe from the Bawi seller website to receive payouts.
            </Text>
          ) : null}
        </View>

        <View className="gap-3">
          <Text className="text-h3 text-ink-950">Needs attention</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/fulfillment")}
            className="flex-row items-center justify-between rounded-md border border-ink-100 p-4 active:bg-ink-100"
          >
            <Text className="text-body text-ink-800">Awaiting preparation</Text>
            {awaitingPreparation === null ? (
              <ActivityIndicator color="#151210" />
            ) : (
              <Text className="text-h3 text-ink-950">{awaitingPreparation}</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/returns")}
            className="flex-row items-center justify-between rounded-md border border-ink-100 p-4 active:bg-ink-100"
          >
            <Text className="text-body text-ink-800">Return requests to review</Text>
            {pendingReturns === null ? (
              <ActivityIndicator color="#151210" />
            ) : (
              <Text className="text-h3 text-ink-950">{pendingReturns}</Text>
            )}
          </Pressable>
        </View>

        <Button variant="secondary" onPress={logout}>
          Log out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
