import { Button, Input, StatusBadge, ThemedActivityIndicator } from "@bawi/mobile-ui";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { getSessionToken } from "@/features/auth/services/token-storage";
import { submitPaymentProof } from "@/features/checkout/services/manual-checkout-client";
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
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshOrder() {
    const token = await getSessionToken();
    setOrder(await getOrder(id, token));
  }

  async function chooseReceipt() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError(t("checkout.photoPermission")); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!result.canceled) setReceipt(result.assets[0]);
  }

  async function sendReceipt() {
    if (!order || !receipt || reference.trim().length < 6) { setError(t("checkout.proofRequired")); return; }
    setSubmitting(true); setError(null);
    try {
      const token = await getSessionToken();
      if (!token) return;
      await submitPaymentProof(token, order.id, reference.trim(), { uri: receipt.uri, name: receipt.fileName ?? "telebirr-receipt.jpg", type: receipt.mimeType ?? "image/jpeg" });
      await refreshOrder();
    } catch { setError(t("checkout.errorGeneric")); }
    finally { setSubmitting(false); }
  }

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

        {order.status === "pending_quote" ? (
          <View className="gap-3 rounded-md bg-info/10 p-4">
            <Text className="font-medium text-info">{t("checkout.quotePending")}</Text>
            <Text className="text-body-sm text-ink-700">{t("orders.quotePending")}</Text>
            <Button variant="secondary" onPress={refreshOrder}>{t("orders.refresh")}</Button>
          </View>
        ) : null}

        {order.status === "pending_payment" ? (
          <View className={`gap-1 rounded-md p-4 ${order.payment_status === "rejected" ? "bg-danger/10" : "bg-info/10"}`}>
            <Text className={`font-medium ${order.payment_status === "rejected" ? "text-danger" : "text-info"}`}>
              {order.payment_status === "rejected" ? t("orders.paymentRejected") : order.payment_status === "pending" ? t("orders.quoteReady") : t("orders.paymentUnderReview")}
            </Text>
            {order.payment_rejection_reason ? <Text className="text-body-sm text-danger">{order.payment_rejection_reason}</Text> : null}
            {order.payment_reference ? <Text className="text-caption text-ink-600">{t("checkout.transactionReference")}: {order.payment_reference}</Text> : null}
          </View>
        ) : null}

        {order.status === "pending_payment" && ["pending", "rejected"].includes(order.payment_status) && order.total !== null && order.payment_recipient_phone ? (
          <View className="gap-3 rounded-md border border-ink-100 p-4">
            <Text className="text-h3 text-ink-950">{t("checkout.telebirrTitle")}</Text>
            <Text className="text-body-sm text-ink-600">{t("checkout.sendExactAmount")}</Text>
            <Text className="text-h1 text-ink-950">{formatPrice(order.total, order.currency_code)}</Text>
            <Text className="text-body text-ink-800">{order.payment_recipient_name}</Text>
            <Text selectable className="text-h2 text-ink-950">{order.payment_recipient_phone}</Text>
            <Text selectable className="text-body-sm text-ink-600">{t("checkout.orderReference")}: {order.display_id}</Text>
            {error ? <Text className="text-body-sm text-danger">{error}</Text> : null}
            <Input label={t("checkout.transactionReference")} value={reference} onChangeText={setReference} autoCapitalize="characters" />
            <Button variant="secondary" onPress={chooseReceipt}>{receipt ? t("checkout.changeReceipt") : t("checkout.uploadReceipt")}</Button>
            {receipt ? <Image source={{ uri: receipt.uri }} style={{ width: "100%", height: 220, borderRadius: 8 }} contentFit="contain" /> : null}
            <Button onPress={sendReceipt} loading={submitting}>{t("checkout.submitForVerification")}</Button>
          </View>
        ) : null}

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
            <Text className="text-body text-ink-950">{order.shipping === null ? t("status.pendingQuote") : formatPrice(order.shipping, order.currency_code)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-body text-ink-700">{t("checkout.tax")}</Text>
            <Text className="text-body text-ink-950">{formatPrice(order.tax, order.currency_code)}</Text>
          </View>
          <View className="flex-row justify-between border-t border-ink-100 pt-2">
            <Text className="text-body-sm font-medium text-ink-950">{t("checkout.total")}</Text>
            <Text className="text-body-sm font-medium text-ink-950">{order.total === null ? t("status.pendingQuote") : formatPrice(order.total, order.currency_code)}</Text>
          </View>
        </View>

        <Text className="text-center text-caption text-ink-500">
          {t("orders.webActions")}
        </Text>
      </ScrollView>
    </View>
  );
}
