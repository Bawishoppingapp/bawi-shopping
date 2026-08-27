import { Button } from "@bawi/mobile-ui";
import { Stack, router } from "expo-router";
import { useEffect, useMemo } from "react";
import { Text, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { useCart } from "@/features/cart/hooks/use-cart";
import { formatMoney } from "@/features/discovery/utils/format-price";

/**
 * Stripe checkout has been removed for now - the app is ETB-only and
 * Stripe has zero support for Ethiopia (no merchant accounts, no
 * Connect), so it could never actually pay a seller out. A real
 * Ethiopian payment integration (Telebirr or another local rail) is
 * planned separately; this screen stays a clear, honest placeholder
 * until that lands rather than collecting an address for an order that
 * can't be paid for.
 */
export default function CheckoutScreen() {
  const { customer } = useAuth();
  const { cart } = useCart();

  useEffect(() => {
    if (!customer) {
      router.replace("/login");
    }
  }, [customer]);

  const summary = useMemo(() => {
    if (!cart) return null;
    return {
      subtotal: formatMoney(cart.subtotal, cart.currency_code),
      shipping: cart.qualifies_for_free_shipping ? "Free" : formatMoney(cart.shipping_estimate, cart.currency_code),
    };
  }, [cart]);

  if (!customer) {
    return null;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper px-6">
        <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
        <Text className="text-h2 text-ink-950">Your bag is empty</Text>
        <Button onPress={() => router.replace("/(tabs)/cart")}>Back to bag</Button>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-paper px-6">
      <Stack.Screen options={{ headerShown: true, title: "Checkout" }} />
      <Text className="text-h2 text-ink-950">Checkout is coming soon</Text>
      <Text className="text-center text-body text-ink-500">
        We&apos;re integrating an Ethiopian payment option so you can pay for Birr orders. Your bag is saved -
        come back once payment is live.
      </Text>
      {summary ? (
        <View className="w-full gap-1 rounded-md border border-ink-100 p-4">
          <View className="flex-row justify-between">
            <Text className="text-body text-ink-700">Subtotal</Text>
            <Text className="text-body text-ink-950">{summary.subtotal}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-body text-ink-700">Shipping</Text>
            <Text className="text-body text-ink-950">{summary.shipping}</Text>
          </View>
        </View>
      ) : null}
      <Button onPress={() => router.back()}>Back to bag</Button>
    </View>
  );
}
