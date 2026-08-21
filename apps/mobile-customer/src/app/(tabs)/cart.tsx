import { Button } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import { formatUsd } from "@/features/discovery/utils/format-price";
import { useCart } from "@/features/cart/hooks/use-cart";
import type { CartItem } from "@/features/cart/services/cart-client";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

function CartLineItem({
  item,
  onIncrement,
  onDecrement,
  onRemove,
  t,
}: {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <View className="flex-row gap-3 border-b border-ink-100 py-4">
      <View className="h-24 w-20 overflow-hidden rounded-md bg-ink-100">
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : null}
      </View>
      <View className="flex-1 gap-1">
        {item.brand ? <Text className="text-caption uppercase tracking-wide text-ink-500">{item.brand}</Text> : null}
        <Text numberOfLines={2} className="text-body-sm text-ink-950">
          {item.title}
        </Text>
        {item.color || item.size ? (
          <Text className="text-caption text-ink-500">
            {[item.color, item.size].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {!item.is_available ? (
          <Text className="text-caption text-danger">No longer available</Text>
        ) : item.quantity > item.available_quantity ? (
          <Text className="text-caption text-warning">Only {item.available_quantity} left</Text>
        ) : null}
        <View className="mt-1 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 rounded-full border border-ink-200 px-2 py-1">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDecrement();
              }}
              hitSlop={8}
            >
              <Text className="text-h3 text-ink-950">−</Text>
            </Pressable>
            <Text className="text-body-sm text-ink-950">{item.quantity}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onIncrement();
              }}
              hitSlop={8}
            >
              <Text className="text-h3 text-ink-950">+</Text>
            </Pressable>
          </View>
          <Text className="text-body-sm font-medium text-ink-950">{formatUsd(item.line_total)}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onRemove}>
          <Text className="text-caption text-ink-500 underline">{t("cart.remove")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const { cart, isLoading, updateQuantity, removeItem } = useCart();
  const tabBarHeight = useBottomTabBarHeight();
  const t = useTranslations();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-h2 text-ink-950">{t("cart.empty")}</Text>
          <Text className="text-body text-ink-500">{t("cart.emptyHint")}</Text>
          <Button onPress={() => router.push("/(tabs)")}>{t("cart.continueShopping")}</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: tabBarHeight }}>
        <Text className="mb-2 text-h1 text-ink-950">{t("cart.title")}</Text>

        {cart.warnings.length > 0 ? (
          <View className="mb-2 gap-1 rounded-md bg-warning/10 p-3">
            {cart.warnings.map((w) => (
              <Text key={`${w.line_item_id}-${w.code}`} className="text-body-sm text-warning">
                {w.message}
              </Text>
            ))}
          </View>
        ) : null}

        {cart.items.map((item) => (
          <CartLineItem
            key={item.id}
            item={item}
            onIncrement={() => updateQuantity(item.id, Math.min(item.quantity + 1, item.max_quantity))}
            onDecrement={() =>
              item.quantity > 1 ? updateQuantity(item.id, item.quantity - 1) : removeItem(item.id)
            }
            onRemove={() => removeItem(item.id)}
            t={t}
          />
        ))}

        <View className="gap-2 py-4">
          {!cart.qualifies_for_free_shipping ? (
            <Text className="text-body-sm text-ink-500">
              Add {formatUsd(cart.amount_remaining_for_free_shipping)} {t("cart.freeShippingProgress")}.
            </Text>
          ) : (
            <Text className="text-body-sm text-success">{t("cart.qualifiesForFreeShipping")}</Text>
          )}
          <View className="flex-row justify-between">
            <Text className="text-body text-ink-700">{t("cart.subtotal")}</Text>
            <Text className="text-body text-ink-950">{formatUsd(cart.subtotal)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-body text-ink-700">{t("cart.shippingEstimate")}</Text>
            <Text className="text-body text-ink-950">
              {cart.qualifies_for_free_shipping ? t("cart.free") : formatUsd(cart.shipping_estimate)}
            </Text>
          </View>
        </View>

        <Button disabled className="mb-2">
          Checkout - coming soon
        </Button>
        <Text className="mb-8 text-center text-caption text-ink-500">
          Checkout is being finished in the next update. Your bag is saved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
