import { Button, Input, useThemeColors } from "@bawi/mobile-ui";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Stack, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { listAddresses, type CustomerAddress } from "@/features/addresses/services/addresses-client";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { useCart } from "@/features/cart/hooks/use-cart";
import { startManualCheckout, submitPaymentProof, type ManualCheckout } from "@/features/checkout/services/manual-checkout-client";
import { useCurrency } from "@/features/currency/hooks/use-currency";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

function toShippingAddress(a: CustomerAddress) {
  return { first_name: a.first_name ?? "", last_name: a.last_name ?? "", address_1: a.address_1 ?? "", address_2: a.address_2 ?? undefined, city: a.city ?? "", province: a.province ?? undefined, postal_code: a.postal_code ?? undefined, country_code: a.country_code ?? "et", phone: a.phone ?? "", sub_city: a.metadata?.sub_city, woreda: a.metadata?.woreda, landmark: a.metadata?.landmark, delivery_notes: a.metadata?.delivery_notes };
}

export default function CheckoutScreen() {
  const { customer } = useAuth();
  const { cart, refresh } = useCart();
  const { formatPrice } = useCurrency();
  const t = useTranslations();
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState<CustomerAddress | null>(null);
  const [checkout, setCheckout] = useState<ManualCheckout | null>(null);
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!customer) router.replace("/login"); }, [customer]);
  useEffect(() => {
    if (!customer) return;
    getSessionToken().then(listAddresses).then((rows) => setAddress(rows.find((row) => row.is_default_shipping) ?? rows[0] ?? null)).finally(() => setLoading(false));
  }, [customer]);

  async function createOrder() {
    if (!address) return;
    setSubmitting(true); setError(null);
    try {
      const token = await getSessionToken();
      if (token) setCheckout(await startManualCheckout(token, toShippingAddress(address), `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`));
    } catch { setError(t("checkout.errorGeneric")); }
    finally { setSubmitting(false); }
  }

  async function chooseReceipt() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError(t("checkout.photoPermission")); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (!result.canceled) setReceipt(result.assets[0]);
  }

  async function sendReceipt() {
    if (!checkout || !receipt || reference.trim().length < 6) { setError(t("checkout.proofRequired")); return; }
    setSubmitting(true); setError(null);
    try {
      const token = await getSessionToken();
      if (!token) return;
      await submitPaymentProof(token, checkout.order_id, reference.trim(), { uri: receipt.uri, name: receipt.fileName ?? "telebirr-receipt.jpg", type: receipt.mimeType ?? "image/jpeg" });
      await refresh();
      router.replace(`/order/${checkout.order_id}`);
    } catch { setError(t("checkout.errorGeneric")); }
    finally { setSubmitting(false); }
  }

  if (!customer || loading) return <SafeAreaView className="flex-1 items-center justify-center bg-paper"><ActivityIndicator color={colors.ink950}/></SafeAreaView>;
  if (!cart || cart.items.length === 0) return <View className="flex-1 items-center justify-center gap-4 bg-paper px-6"><Stack.Screen options={{ headerShown: true, title: t("checkout.title") }}/><Text className="text-h2 text-ink-950">{t("checkout.bagEmpty")}</Text><Button onPress={() => router.replace("/(tabs)/cart")}>{t("checkout.backToBag")}</Button></View>;

  return <SafeAreaView className="flex-1 bg-paper" edges={["bottom"]}>
    <Stack.Screen options={{ headerShown: true, title: t("checkout.title") }}/>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      {error ? <View className="rounded-md bg-danger/10 p-3"><Text className="text-body-sm text-danger">{error}</Text></View> : null}
      {!checkout ? <>
        <Text className="text-h2 text-ink-950">{t("checkout.shippingAddress")}</Text>
        {address ? <View className="rounded-md border border-ink-100 p-4"><Text className="font-medium text-ink-950">{address.first_name} {address.last_name}</Text><Text className="text-body-sm text-ink-600">{address.address_1}, {address.city}</Text></View> : <View className="gap-3 rounded-md border border-ink-100 p-4"><Text className="text-body-sm text-ink-700">{t("checkout.addressRequired")}</Text><Button variant="secondary" onPress={() => router.push("/(tabs)/account/addresses/new")}>{t("address.add")}</Button></View>}
        <Text className="text-h2 text-ink-950">{t("checkout.orderSummary")}</Text>
        <View className="gap-2 rounded-md border border-ink-100 p-4"><View className="flex-row justify-between"><Text>{t("checkout.subtotal")}</Text><Text>{formatPrice(cart.subtotal, cart.currency_code)}</Text></View><View className="flex-row justify-between"><Text>{t("checkout.shipping")}</Text><Text>{cart.qualifies_for_free_shipping ? t("cart.free") : formatPrice(cart.shipping_estimate, cart.currency_code)}</Text></View><Text className="text-caption text-ink-500">{t("checkout.taxCalculated")}</Text></View>
        <Button onPress={createOrder} loading={submitting} disabled={!address}>{t("checkout.continueToPayment")}</Button>
      </> : <>
        <Text className="text-h2 text-ink-950">{t("checkout.telebirrTitle")}</Text>
        <View className="gap-3 rounded-md border border-ink-100 p-4"><Text className="text-body-sm text-ink-600">{t("checkout.sendExactAmount")}</Text><Text className="text-h1 text-ink-950">{formatPrice(checkout.total, checkout.currency_code)}</Text><Text className="text-body text-ink-800">{checkout.payment_recipient_name}</Text><Text selectable className="text-h2 text-ink-950">{checkout.payment_recipient_phone}</Text><Text selectable className="text-body-sm text-ink-600">{t("checkout.orderReference")}: {checkout.display_id}</Text></View>
        <View className="gap-1 rounded-md border border-ink-100 p-4"><View className="flex-row justify-between"><Text>{t("checkout.subtotal")}</Text><Text>{formatPrice(checkout.subtotal, checkout.currency_code)}</Text></View><View className="flex-row justify-between"><Text>{t("checkout.shipping")}</Text><Text>{formatPrice(checkout.shipping, checkout.currency_code)}</Text></View><View className="flex-row justify-between"><Text>{t("checkout.tax")}</Text><Text>{formatPrice(checkout.tax, checkout.currency_code)}</Text></View><View className="mt-2 flex-row justify-between border-t border-ink-100 pt-2"><Text className="font-semibold">{t("checkout.total")}</Text><Text className="font-semibold">{formatPrice(checkout.total, checkout.currency_code)}</Text></View></View>
        <Input label={t("checkout.transactionReference")} value={reference} onChangeText={setReference} autoCapitalize="characters" />
        <Button variant="secondary" onPress={chooseReceipt}>{receipt ? t("checkout.changeReceipt") : t("checkout.uploadReceipt")}</Button>
        {receipt ? <Image source={{ uri: receipt.uri }} style={{ width: "100%", height: 220, borderRadius: 8 }} contentFit="contain"/> : null}
        <Text className="text-caption text-ink-500">{t("checkout.verificationNotice")}</Text>
        <Button onPress={sendReceipt} loading={submitting}>{t("checkout.submitForVerification")}</Button>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
