import { Button, ProductCard } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { type ProductHit, searchProducts } from "@/features/discovery/services/discovery-client";
import { formatMoney } from "@/features/discovery/utils/format-price";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { useCart } from "@/features/cart/hooks/use-cart";
import type { CartItem } from "@/features/cart/services/cart-client";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";
import { addToWishlist } from "@/features/wishlist/services/wishlist-client";

const RECOMMENDATIONS_LIMIT = 8;

function CartLineItem({
  item,
  currencyCode,
  onIncrement,
  onDecrement,
  onRemove,
  onSaveForLater,
  t,
}: {
  item: CartItem;
  currencyCode: string;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onSaveForLater: (() => void) | null;
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
          <Text className="text-body-sm font-medium text-ink-950">{formatMoney(item.line_total, currencyCode)}</Text>
        </View>
        <View className="flex-row gap-4">
          <Pressable accessibilityRole="button" onPress={onRemove}>
            <Text className="text-caption text-ink-500 underline">{t("cart.remove")}</Text>
          </Pressable>
          {onSaveForLater ? (
            <Pressable accessibilityRole="button" onPress={onSaveForLater}>
              <Text className="text-caption text-ink-500 underline">Save for later</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const { cart, isLoading, updateQuantity, removeItem } = useCart();
  const { customer } = useAuth();
  const locale = useLocale();
  const tabBarHeight = useBottomTabBarHeight();
  const t = useTranslations();
  const [savingForLater, setSavingForLater] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<ProductHit[]>([]);

  async function onSaveForLater(item: CartItem) {
    if (!item.product_code || savingForLater) return;
    setSavingForLater(item.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const token = await getSessionToken();
    const ok = await addToWishlist(item.product_code, token);
    if (ok) await removeItem(item.id);
    setSavingForLater(null);
  }

  // Recommendations are keyed off the first line item's brand - simple,
  // honest proxy for "similar to what's in your bag" without a real
  // recommendation engine. Re-fetched whenever that brand changes, and
  // filtered against everything currently in cart so it never suggests
  // an item already there.
  const firstBrand = cart?.items[0]?.brand ?? null;
  useEffect(() => {
    if (!firstBrand) {
      setRecommendations([]);
      return;
    }
    let cancelled = false;
    const inCartCodes = new Set(cart?.items.map((i) => i.product_code).filter(Boolean));
    searchProducts({ brand: firstBrand, limit: RECOMMENDATIONS_LIMIT, locale })
      .then((result) => {
        if (!cancelled) setRecommendations(result.products.filter((p) => !inCartCodes.has(p.productCode)));
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cart.items is intentionally excluded: it changes on every quantity tick and would refetch far more often than the brand-based recommendation set needs to change.
  }, [firstBrand, locale]);

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
      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
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
            currencyCode={cart.currency_code}
            onIncrement={() => updateQuantity(item.id, Math.min(item.quantity + 1, item.max_quantity))}
            onDecrement={() =>
              item.quantity > 1 ? updateQuantity(item.id, item.quantity - 1) : removeItem(item.id)
            }
            onRemove={() => removeItem(item.id)}
            onSaveForLater={customer && item.product_code ? () => onSaveForLater(item) : null}
            t={t}
          />
        ))}

        {recommendations.length > 0 ? (
          <View className="gap-2 pt-6">
            <Text className="text-h3 text-ink-950">You might also like</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {recommendations.map((item) => (
                <View key={item.productCode} style={{ width: 140 }}>
                  <ProductCard
                    product={toProductCardData(item)}
                    onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky checkout summary - sits above the floating tab bar rather
          than scrolling away with a potentially long line-item list. */}
      <View
        style={{ paddingBottom: tabBarHeight }}
        className="gap-2 border-t border-ink-100 bg-paper px-4 pt-3"
      >
        {!cart.qualifies_for_free_shipping ? (
          <Text className="text-body-sm text-ink-500">
            Add {formatMoney(cart.amount_remaining_for_free_shipping, cart.currency_code)} {t("cart.freeShippingProgress")}.
          </Text>
        ) : (
          <Text className="text-body-sm text-success">{t("cart.qualifiesForFreeShipping")}</Text>
        )}
        <View className="flex-row justify-between">
          <Text className="text-body text-ink-700">{t("cart.subtotal")}</Text>
          <Text className="text-body text-ink-950">{formatMoney(cart.subtotal, cart.currency_code)}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-body text-ink-700">{t("cart.shippingEstimate")}</Text>
          <Text className="text-body text-ink-950">
            {cart.qualifies_for_free_shipping ? t("cart.free") : formatMoney(cart.shipping_estimate, cart.currency_code)}
          </Text>
        </View>

        <Button disabled>Checkout - coming soon</Button>
        <Text className="pb-2 text-center text-caption text-ink-500">
          Checkout is being finished in the next update. Your bag is saved.
        </Text>
      </View>
    </SafeAreaView>
  );
}
