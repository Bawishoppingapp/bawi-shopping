import { Button, StatusBadge } from "@bawi/mobile-ui";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { getSessionToken } from "@/features/auth/services/token-storage";
import {
  type FulfillmentOrder,
  FulfillmentClientError,
  getFulfillmentOrder,
  markPreparing,
  markReadyForPickup,
} from "@/features/fulfillment/services/fulfillment-client";
import { fulfillmentStatusBadge } from "@/features/fulfillment/utils/status";
import { formatUsd } from "@/utils/format-price";

export default function FulfillmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<FulfillmentOrder | null | undefined>(undefined);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) return;
    const result = await getFulfillmentOrder(token, id).catch(() => null);
    setOrder(result);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onMarkPreparing() {
    const token = await getSessionToken();
    if (!token) return;
    setActionError(null);
    setUpdating(true);
    try {
      const result = await markPreparing(token, id);
      setOrder(result);
    } catch (error) {
      setActionError(error instanceof FulfillmentClientError ? error.message : "Something went wrong.");
    } finally {
      setUpdating(false);
    }
  }

  async function onMarkReady() {
    const token = await getSessionToken();
    if (!token) return;
    setActionError(null);
    setUpdating(true);
    try {
      const result = await markReadyForPickup(token, id);
      setOrder(result);
    } catch (error) {
      setActionError(error instanceof FulfillmentClientError ? error.message : "Something went wrong.");
    } finally {
      setUpdating(false);
    }
  }

  if (order === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#151210" />
      </View>
    );
  }

  if (order === null) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-paper px-6">
        <Stack.Screen options={{ title: "Order" }} />
        <Text className="text-h2 text-ink-950">Not found</Text>
      </View>
    );
  }

  const badge = fulfillmentStatusBadge(order.status);

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen options={{ title: order.fulfillment_code }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-h1 text-ink-950">{order.fulfillment_code}</Text>
          <StatusBadge label={badge.label} tone={badge.tone} />
        </View>
        <Text className="text-body-sm text-ink-500">
          Fulfill by {new Date(order.fulfillment_deadline_at).toLocaleDateString()}
        </Text>

        <View className="gap-3 rounded-md border border-ink-100 p-4">
          {order.items.map((item) => (
            <View key={item.id} className="flex-row justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text className="text-body-sm text-ink-950">{item.title}</Text>
                <Text className="text-caption text-ink-500">
                  {[item.color, item.size].filter(Boolean).join(" · ")} × {item.quantity}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View className="gap-2 rounded-md border border-ink-100 p-4">
          <View className="flex-row justify-between">
            <Text className="text-body text-ink-700">Subtotal</Text>
            <Text className="text-body text-ink-950">{formatUsd(order.subtotal)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-body text-ink-700">Commission</Text>
            <Text className="text-body text-ink-950">-{formatUsd(order.commission_amount)}</Text>
          </View>
          <View className="flex-row justify-between border-t border-ink-100 pt-2">
            <Text className="text-body-sm font-medium text-ink-950">You earn</Text>
            <Text className="text-body-sm font-medium text-ink-950">
              {formatUsd(order.total - order.commission_amount)}
            </Text>
          </View>
        </View>

        {order.pickup_code ? (
          <View className="gap-1 rounded-md border border-info/30 bg-info/10 p-3">
            <Text className="text-caption font-medium text-info">Pickup code</Text>
            <Text className="text-caption text-ink-700">Show this to the courier when they arrive.</Text>
            <Text className="mt-1 text-h3 tracking-widest text-info">{order.pickup_code}</Text>
          </View>
        ) : null}

        {actionError ? <Text className="text-body-sm text-danger">{actionError}</Text> : null}

        {order.status === "awaiting_preparation" ? (
          <Button onPress={onMarkPreparing} loading={updating}>
            Mark as preparing
          </Button>
        ) : order.status === "preparing" ? (
          <Button onPress={onMarkReady} loading={updating}>
            Mark ready for pickup
          </Button>
        ) : null}
      </ScrollView>
    </View>
  );
}
