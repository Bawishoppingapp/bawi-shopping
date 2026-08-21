import { Button, StatusBadge } from "@bawi/mobile-ui";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import { listFulfillmentOrders } from "@/features/fulfillment/services/fulfillment-client";
import { listReturnRequests } from "@/features/returns/services/returns-client";
import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";
import { useSellerAuth } from "@/features/seller-auth/hooks/use-seller-auth";

export default function SellDashboardScreen() {
  const { seller, logout } = useSellerAuth();
  const [awaitingPreparation, setAwaitingPreparation] = useState<number | null>(null);
  const [pendingReturns, setPendingReturns] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const token = await getSellerSessionToken();
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

  async function onLogout() {
    await logout();
    router.replace("/sell");
  }

  if (!seller) return null;

  const stripeReady = seller.seller.stripe.charges_enabled && seller.seller.stripe.payouts_enabled;
  const countsLoaded = awaitingPreparation !== null && pendingReturns !== null;
  const totalActionItems = (awaitingPreparation ?? 0) + (pendingReturns ?? 0);

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View className="gap-1">
          <Text className="text-caption uppercase tracking-wide text-ink-500">Signed in as</Text>
          <Text className="text-h1 text-ink-950">{seller.seller.name}</Text>
        </View>

        {countsLoaded ? (
          <View
            className={`gap-1 rounded-md p-4 ${
              totalActionItems > 0 ? "bg-warning/10" : "bg-success/10"
            }`}
          >
            <Text className={`text-h3 ${totalActionItems > 0 ? "text-warning" : "text-success"}`}>
              {totalActionItems > 0
                ? `${totalActionItems} thing${totalActionItems === 1 ? "" : "s"} need${
                    totalActionItems === 1 ? "s" : ""
                  } your attention`
                : "You're all caught up"}
            </Text>
            {totalActionItems > 0 ? (
              <Text className="text-body-sm text-ink-700">
                {[
                  awaitingPreparation && awaitingPreparation > 0
                    ? `${awaitingPreparation} order${awaitingPreparation === 1 ? "" : "s"} to prepare`
                    : null,
                  pendingReturns && pendingReturns > 0
                    ? `${pendingReturns} return${pendingReturns === 1 ? "" : "s"} to review`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View className="gap-2 rounded-md border border-ink-100 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-body-sm font-medium text-ink-950">Stripe payouts</Text>
            <StatusBadge label={stripeReady ? "Ready" : "Setup needed"} tone={stripeReady ? "success" : "warning"} />
          </View>
          {!stripeReady ? (
            <Text className="text-body-sm text-ink-500">
              Finish connecting Stripe from the Bawi seller website to receive payouts.
            </Text>
          ) : null}
        </View>

        <View className="gap-3">
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/sell/products")}
            className="flex-row items-center justify-between rounded-md border border-ink-100 p-4 active:bg-ink-100"
          >
            <Text className="text-body text-ink-800">Products</Text>
            <Text className="text-body-sm text-ink-500">{">"}</Text>
          </Pressable>

          <Text className="text-h3 text-ink-950">Needs attention</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/sell/fulfillment")}
            className="flex-row items-center justify-between rounded-md border border-ink-100 p-4 active:bg-ink-100"
          >
            <Text className="text-body text-ink-800">Awaiting preparation</Text>
            {awaitingPreparation === null ? (
              <ActivityIndicator color="#151210" />
            ) : (
              <StatusBadge
                label={String(awaitingPreparation)}
                tone={awaitingPreparation > 0 ? "warning" : "neutral"}
              />
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/sell/returns")}
            className="flex-row items-center justify-between rounded-md border border-ink-100 p-4 active:bg-ink-100"
          >
            <Text className="text-body text-ink-800">Return requests to review</Text>
            {pendingReturns === null ? (
              <ActivityIndicator color="#151210" />
            ) : (
              <StatusBadge label={String(pendingReturns)} tone={pendingReturns > 0 ? "warning" : "neutral"} />
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/sell/finance")}
            className="flex-row items-center justify-between rounded-md border border-ink-100 p-4 active:bg-ink-100"
          >
            <Text className="text-body text-ink-800">Finance</Text>
            <Text className="text-body-sm text-ink-500">{">"}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/sell/notifications")}
            className="flex-row items-center justify-between rounded-md border border-ink-100 p-4 active:bg-ink-100"
          >
            <Text className="text-body text-ink-800">Notifications</Text>
            <Text className="text-body-sm text-ink-500">{">"}</Text>
          </Pressable>
        </View>

        <Button variant="secondary" onPress={onLogout}>
          Log out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
