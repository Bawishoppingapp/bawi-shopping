import { StatusBadge, ThemedActivityIndicator } from "@bawi/mobile-ui";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { getSessionToken } from "@/features/auth/services/token-storage";
import { useCurrency } from "@/features/currency/hooks/use-currency";
import { type OrderDetail, getOrder } from "@/features/orders/services/orders-client";
import { orderStatusBadge } from "@/features/orders/utils/order-status";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const locale = useLocale();
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState<OrderDetail | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getSessionToken();
      const result = await getOrder(id, token);
      if (!cancelled) setOrder(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (order === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ThemedActivityIndicator />
      </View>
    );
  }

  if (order === null) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-paper px-6">
        <Stack.Screen options={{ title: t("order.number") }} />
        <Text className="text-h2 text-ink-950">{t("orders.notFound")}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen options={{ title: `${t("order.number")} ${order.display_id}` }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-caption uppercase tracking-wide text-ink-500">{t("order.number")}</Text>
            <Text className="text-h3 text-ink-950">{order.display_id}</Text>
          </View>
          <Text className="text-caption text-ink-500">
            {t("orders.placed", { date: new Date(order.created_at).toLocaleDateString(locale) })}
          </Text>
        </View>

        {order.vendor_orders.map((vendorOrder) => {
          const badge = orderStatusBadge(vendorOrder.status, t);
          return (
            <View key={vendorOrder.id} className="gap-3 rounded-md border border-ink-100 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-caption text-ink-500">{t("order.soldBy")} {vendorOrder.brand}</Text>
                <StatusBadge label={badge.label} tone={badge.tone} />
              </View>

              <View className="gap-3">
                {vendorOrder.items.map((item) => (
                  <View key={item.id} className="flex-row gap-3">
                    <View className="h-20 w-16 overflow-hidden rounded-md bg-ink-100">
                      {item.thumbnail ? (
                        <Image
                          source={{ uri: item.thumbnail }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : null}
                    </View>
                    <View className="flex-1 gap-1">
                      <Text numberOfLines={2} className="text-body-sm text-ink-950">
                        {item.title}
                      </Text>
                      <Text className="text-caption text-ink-500">
                        {[item.color, item.size].filter(Boolean).join(" · ")} × {item.quantity}
                      </Text>
                    </View>
                    <Text className="text-body-sm font-medium text-ink-950">{formatPrice(item.line_total, order.currency_code)}</Text>
                  </View>
                ))}
              </View>

              {vendorOrder.delivery_confirmation_code ? (
                <View className="gap-1 rounded-md border border-info/30 bg-info/10 p-3">
                  <Text className="text-caption font-medium text-info">{t("orders.deliveryCode")}</Text>
                  <Text className="text-caption text-ink-700">
                    {t("orders.deliveryHint")}
                  </Text>
                  <Text className="mt-1 text-h3 tracking-widest text-info">
                    {vendorOrder.delivery_confirmation_code}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <View className="gap-2 rounded-md border border-ink-100 p-4">
          <View className="flex-row justify-between">
            <Text className="text-body text-ink-700">{t("checkout.subtotal")}</Text>
            <Text className="text-body text-ink-950">{formatPrice(order.subtotal, order.currency_code)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-body text-ink-700">{t("checkout.shipping")}</Text>
            <Text className="text-body text-ink-950">{formatPrice(order.shipping, order.currency_code)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-body text-ink-700">{t("checkout.tax")}</Text>
            <Text className="text-body text-ink-950">{formatPrice(order.tax, order.currency_code)}</Text>
          </View>
          <View className="flex-row justify-between border-t border-ink-100 pt-2">
            <Text className="text-body-sm font-medium text-ink-950">{t("checkout.total")}</Text>
            <Text className="text-body-sm font-medium text-ink-950">{formatPrice(order.total, order.currency_code)}</Text>
          </View>
        </View>

        <Text className="text-center text-caption text-ink-500">
          {t("orders.webActions")}
        </Text>
      </ScrollView>
    </View>
  );
}
