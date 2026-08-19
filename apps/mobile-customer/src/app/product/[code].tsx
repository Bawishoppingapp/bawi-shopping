import { DEFAULT_LOCALE } from "@bawi/i18n/locales";
import { Button } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { type PublicProduct, getPublicProduct } from "@/features/products/services/products-client";
import { formatUsd } from "@/features/discovery/utils/format-price";
import { useCart } from "@/features/cart/hooks/use-cart";
import { addToWishlist, listWishlist, removeFromWishlist } from "@/features/wishlist/services/wishlist-client";

export default function ProductDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { width } = useWindowDimensions();
  const { customer } = useAuth();
  const { addItem } = useCart();
  const [product, setProduct] = useState<PublicProduct | null | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingWishlist, setSavingWishlist] = useState(false);
  // Keyed to the variant it applied to, so switching color/size
  // automatically "resets" the added/error state without a separate
  // effect - it just no longer matches the currently selected variant.
  const [lastAddResult, setLastAddResult] = useState<
    { variantId: string; status: "added" } | { variantId: string; status: "error"; message: string } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    getPublicProduct(code, DEFAULT_LOCALE)
      .then((result) => {
        if (cancelled) return;
        setProduct(result);
        if (result) {
          setSelectedColor(result.colors[0] ?? null);
          setSelectedSize(result.sizes[0] ?? null);
        }
      })
      .catch(() => {
        // Network/server unreachable, not just a 404 - getPublicProduct
        // only handles non-ok responses itself, so a thrown fetch error
        // (no connection) needs its own catch or this screen is stuck on
        // its loading spinner forever.
        if (!cancelled) setProduct(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!customer || !code) {
      setSaved(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await getSessionToken();
      const items = await listWishlist(token);
      if (!cancelled) setSaved(items.some((item) => item.productCode === code));
    })();
    return () => {
      cancelled = true;
    };
  }, [customer, code]);

  async function onToggleSave() {
    if (!customer) {
      router.push("/login");
      return;
    }
    setSavingWishlist(true);
    const wasSaved = saved;
    setSaved(!wasSaved);
    const token = await getSessionToken();
    const ok = wasSaved ? await removeFromWishlist(code, token) : await addToWishlist(code, token);
    if (!ok) setSaved(wasSaved);
    setSavingWishlist(false);
  }

  const selectedVariant = useMemo(() => {
    if (!product) return null;
    return (
      product.variants.find((v) => v.color === selectedColor && v.size === selectedSize) ?? null
    );
  }, [product, selectedColor, selectedSize]);

  async function onAddToBag() {
    if (!selectedVariant) return;
    const variantId = selectedVariant.id;
    setAdding(true);
    try {
      await addItem(variantId, 1);
      setLastAddResult({ variantId, status: "added" });
    } catch {
      setLastAddResult({ variantId, status: "error", message: "Couldn't add this to your bag. Please try again." });
    } finally {
      setAdding(false);
    }
  }

  if (product === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#151210" />
      </View>
    );
  }

  if (product === null) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-paper px-6">
        <Stack.Screen options={{ title: "Product" }} />
        <Text className="text-h2 text-ink-950">Not found</Text>
        <Text className="text-body text-ink-500">This product isn&apos;t available anymore.</Text>
      </View>
    );
  }

  const price = selectedVariant?.price ?? product.base_price;
  const isAvailable = selectedVariant ? selectedVariant.available_quantity > 0 : false;
  const imageSize = width;
  const addResultForSelection =
    selectedVariant && lastAddResult?.variantId === selectedVariant.id ? lastAddResult : null;
  const added = addResultForSelection?.status === "added";
  const addError = addResultForSelection?.status === "error" ? addResultForSelection.message : null;

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen options={{ title: product.brand }} />
      <ScrollView>
        <View style={{ width: imageSize, height: imageSize }} className="bg-ink-100">
          {product.thumbnail ? (
            <Image
              source={{ uri: product.thumbnail }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
            />
          ) : null}
        </View>

        {product.images.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16 }}>
            {product.images.map((uri) => (
              <Image key={uri} source={{ uri }} style={{ width: 64, height: 80, borderRadius: 6 }} contentFit="cover" />
            ))}
          </ScrollView>
        ) : null}

        <View className="gap-4 px-4 pb-8 pt-2">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1 gap-1">
              <Text className="text-caption uppercase tracking-wide text-ink-500">{product.brand}</Text>
              <Text className="text-h1 text-ink-950">{product.title}</Text>
              <Text className="text-h3 text-ink-950">{formatUsd(price)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? "Remove from wishlist" : "Save to wishlist"}
              onPress={onToggleSave}
              disabled={savingWishlist}
              className="p-2"
            >
              <Ionicons name={saved ? "heart" : "heart-outline"} size={26} color="#151210" />
            </Pressable>
          </View>

          {product.colors.length > 0 ? (
            <View className="gap-2">
              <Text className="text-body-sm font-medium text-ink-800">Color</Text>
              <View className="flex-row flex-wrap gap-2">
                {product.colors.map((color) => (
                  <Text
                    key={color}
                    onPress={() => setSelectedColor(color)}
                    className={`rounded-full border px-3 py-1.5 text-body-sm ${
                      selectedColor === color
                        ? "border-ink-950 bg-ink-950 text-white"
                        : "border-ink-200 text-ink-700"
                    }`}
                  >
                    {color}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          {product.sizes.length > 0 ? (
            <View className="gap-2">
              <Text className="text-body-sm font-medium text-ink-800">Size</Text>
              <View className="flex-row flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <Text
                    key={size}
                    onPress={() => setSelectedSize(size)}
                    className={`rounded-full border px-3 py-1.5 text-body-sm ${
                      selectedSize === size
                        ? "border-ink-950 bg-ink-950 text-white"
                        : "border-ink-200 text-ink-700"
                    }`}
                  >
                    {size}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          {!isAvailable ? (
            <Text className="text-body-sm text-danger">
              {selectedVariant ? "Out of stock in this size/color." : "Select a size and color."}
            </Text>
          ) : null}

          {addError ? <Text className="text-body-sm text-danger">{addError}</Text> : null}

          <Button disabled={!isAvailable || adding} loading={adding} onPress={onAddToBag}>
            {added ? "Added to bag" : "Add to bag"}
          </Button>

          {product.description ? (
            <View className="gap-1 pt-2">
              <Text className="text-body-sm font-medium text-ink-800">Details</Text>
              <Text className="text-body text-ink-700">{product.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
