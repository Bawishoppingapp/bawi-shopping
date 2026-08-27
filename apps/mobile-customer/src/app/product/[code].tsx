import { Button, ProductCard } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { type PublicProduct, getPublicProduct } from "@/features/products/services/products-client";
import { type ProductHit, searchProducts } from "@/features/discovery/services/discovery-client";
import { formatMoney } from "@/features/discovery/utils/format-price";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { recordProductView } from "@/features/discovery/services/recently-viewed";
import { useCart } from "@/features/cart/hooks/use-cart";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";
import { useToast } from "@/features/toast/use-toast";
import { type ShippingPolicy, getShippingPolicy } from "@/features/shipping-policy/services/shipping-policy-client";
import { addToWishlist, listWishlist, removeFromWishlist } from "@/features/wishlist/services/wishlist-client";

const RELATED_PRODUCTS_LIMIT = 8;

export default function ProductDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { width } = useWindowDimensions();
  const { customer } = useAuth();
  const { addItem } = useCart();
  const locale = useLocale();
  const t = useTranslations();
  const toast = useToast();
  const [product, setProduct] = useState<PublicProduct | null | undefined>(undefined);
  const [relatedProducts, setRelatedProducts] = useState<ProductHit[]>([]);
  const [shippingPolicy, setShippingPolicy] = useState<ShippingPolicy | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const galleryRef = useRef<ScrollView>(null);
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
    getPublicProduct(code, locale)
      .then((result) => {
        if (cancelled) return;
        setProduct(result);
        if (result) {
          setSelectedColor(result.colors[0] ?? null);
          setSelectedSize(result.sizes[0] ?? null);
          const prices = result.variants.map((v) => v.price).filter((p): p is number => p !== null);
          recordProductView({
            productCode: result.product_code,
            title: result.title,
            brand: result.brand,
            thumbnail: result.thumbnail,
            priceMin: prices.length ? Math.min(...prices) : result.base_price,
            priceMax: prices.length ? Math.max(...prices) : result.base_price,
            currencyCode: result.currency_code,
            available: result.variants.some((v) => v.available_quantity > 0),
            categoryIds: [],
          });
          searchProducts({ brand: result.brand, limit: RELATED_PRODUCTS_LIMIT, locale })
            .then((searchResult) =>
              setRelatedProducts(searchResult.products.filter((p) => p.productCode !== result.product_code))
            )
            .catch(() => setRelatedProducts([]));
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
  }, [code, locale]);

  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    getShippingPolicy(product.currency_code).then((policy) => {
      if (!cancelled) setShippingPolicy(policy);
    });
    return () => {
      cancelled = true;
    };
  }, [product]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show(`Added to bag${product ? ` · ${product.title}` : ""}`, {
        actionLabel: "View bag",
        onPress: () => router.push("/(tabs)/cart"),
      });
    } catch (error) {
      setLastAddResult({
        variantId,
        status: "error",
        message: error instanceof Error ? error.message : "Couldn't add this to your bag. Please try again.",
      });
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
        <Text className="text-h2 text-ink-950">{t("product.notFound")}</Text>
        <Text className="text-body text-ink-500">This product isn&apos;t available anymore.</Text>
      </View>
    );
  }

  const price = selectedVariant?.price ?? product.base_price;
  const isAvailable = selectedVariant ? selectedVariant.available_quantity > 0 : false;
  const imageSize = width;
  // Thumbnail first, then any additional images not already equal to it -
  // avoids showing the same photo twice when the backend's `images` list
  // already includes the thumbnail.
  const galleryImages = product.thumbnail
    ? [product.thumbnail, ...product.images.filter((uri) => uri !== product.thumbnail)]
    : product.images;

  function onGalleryScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / imageSize);
    setActiveImageIndex(index);
  }

  function goToImage(index: number) {
    setActiveImageIndex(index);
    galleryRef.current?.scrollTo({ x: index * imageSize, animated: true });
  }
  const addResultForSelection =
    selectedVariant && lastAddResult?.variantId === selectedVariant.id ? lastAddResult : null;
  const added = addResultForSelection?.status === "added";
  const addError = addResultForSelection?.status === "error" ? addResultForSelection.message : null;

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen options={{ title: product.brand }} />
      <ScrollView>
        <View style={{ width: imageSize, height: imageSize }} className="bg-ink-100">
          {galleryImages.length > 0 ? (
            <ScrollView
              ref={galleryRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onGalleryScroll}
            >
              {galleryImages.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={{ width: imageSize, height: imageSize }}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
          ) : null}
          {galleryImages.length > 1 ? (
            <View className="absolute bottom-3 w-full flex-row items-center justify-center gap-1.5">
              {galleryImages.map((uri, index) => (
                <View
                  key={uri}
                  className={`h-1.5 rounded-full ${
                    index === activeImageIndex ? "w-4 bg-white" : "w-1.5 bg-white/60"
                  }`}
                />
              ))}
            </View>
          ) : null}
        </View>

        {galleryImages.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16 }}>
            {galleryImages.map((uri, index) => (
              <Pressable key={uri} accessibilityRole="button" onPress={() => goToImage(index)}>
                <Image
                  source={{ uri }}
                  style={{
                    width: 64,
                    height: 80,
                    borderRadius: 6,
                    borderWidth: index === activeImageIndex ? 2 : 0,
                    borderColor: "#151210",
                  }}
                  contentFit="cover"
                />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View className="gap-4 px-4 pb-8 pt-2">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1 gap-1">
              <Text className="text-caption uppercase tracking-wide text-ink-500">{product.brand}</Text>
              <Text className="text-h1 text-ink-950">{product.title}</Text>
              <Text className="text-h3 text-ink-950">{formatMoney(price, product.currency_code)}</Text>
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
              <Text className="text-body-sm font-medium text-ink-800">{t("product.colors")}</Text>
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
              <Text className="text-body-sm font-medium text-ink-800">{t("product.sizes")}</Text>
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
              {selectedVariant ? t("product.outOfStock") : "Select a size and color."}
            </Text>
          ) : null}

          {addError ? <Text className="text-body-sm text-danger">{addError}</Text> : null}

          <Button disabled={!isAvailable || adding} loading={adding} onPress={onAddToBag}>
            {added ? t("cart.addedToCart") : t("cart.addToCart")}
          </Button>

          {product.description ? (
            <View className="gap-1 pt-2">
              <Text className="text-body-sm font-medium text-ink-800">Details</Text>
              <Text className="text-body text-ink-700">{product.description}</Text>
            </View>
          ) : null}

          {shippingPolicy ? (
            <View className="gap-2 rounded-md border border-ink-100 p-3">
              <View className="flex-row items-center gap-2">
                <Ionicons name="cube-outline" size={18} color="#4A423B" />
                <Text className="flex-1 text-body-sm text-ink-700">
                  {price >= shippingPolicy.freeShippingThresholdCents
                    ? "This item qualifies for free shipping"
                    : `Free shipping on orders over ${formatMoney(shippingPolicy.freeShippingThresholdCents, product.currency_code)} · otherwise ${formatMoney(shippingPolicy.standardShippingFeeCents, product.currency_code)}`}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="return-up-back-outline" size={18} color="#4A423B" />
                <Text className="flex-1 text-body-sm text-ink-700">
                  Returns accepted within {shippingPolicy.returnWindowDays} days of delivery
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {relatedProducts.length > 0 ? (
          <View className="gap-2 pb-8">
            <Text className="px-4 text-h3 text-ink-950">More from {product.brand}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
              {relatedProducts.map((item) => (
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
    </View>
  );
}
