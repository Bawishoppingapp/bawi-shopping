import { Button, ProductCard, ThemedActivityIndicator, ThemedIcon } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import type { ProductHit } from "@/features/discovery/services/discovery-client";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { useCurrency } from "@/features/currency/hooks/use-currency";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";
import { readWishlist, removeFromWishlist } from "@/features/wishlist/services/wishlist-client";

export default function WishlistScreen() {
  const { customer, isLoading: authLoading } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const locale = useLocale();
  const t = useTranslations();
  const { formatPrice } = useCurrency();
  const identity = JSON.stringify([customer?.id, locale]);
  const [snapshot, setSnapshot] = useState<{ identity: string; products: ProductHit[] } | null>(null);
  const products = snapshot?.identity === identity ? snapshot.products : [];
  const loaded = snapshot?.identity === identity;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const version = useRef(0);

  const load = useCallback(async (force = false) => {
    const request = ++version.current;
    setError(false);
    setLoading(true);
    try {
      const token = await getSessionToken();
      const result = await readWishlist(token, locale, force);
      if (request === version.current) setSnapshot({ identity, products: result });
    } catch {
      if (request === version.current) setError(true);
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [identity, locale]);

  useFocusEffect(useCallback(() => {
    if (!authLoading && customer) void load();
    return () => { version.current++; };
  }, [authLoading, customer, load]));

  async function onRemove(productCode: string) {
    setRemovingCode(productCode);
    try {
      const token = await getSessionToken();
      const ok = await removeFromWishlist(productCode, token);
      if (ok) {
        version.current++;
        setLoading(false);
        setSnapshot((prev) => prev?.identity === identity ? { ...prev, products: prev.products.filter((p) => p.productCode !== productCode) } : prev);
      } else setError(true);
    } catch {
      setError(true);
    } finally {
      setRemovingCode(null);
    }
  }

  if (!authLoading && !customer) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 justify-center gap-4 px-6">
          <View className="gap-1">
            <Text className="text-h1 text-ink-950">{t("nav.wishlist")}</Text>
            <Text className="text-body text-ink-500">{t("wishlist.loginHint")}</Text>
          </View>
          <Button onPress={() => router.push("/login")}>{t("login.submit")}</Button>
          <Button variant="secondary" onPress={() => router.push("/register")}>
            {t("register.submit")}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (authLoading || (!loaded && !error)) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ThemedActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <FlatList
        data={products}
        refreshing={loading && loaded}
        onRefresh={() => load(true)}
        keyExtractor={(item) => item.productCode}
        numColumns={2}
        columnWrapperStyle={{ gap: 16, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 16, paddingTop: 8, paddingBottom: tabBarHeight + 32 }}
        ListHeaderComponent={<View className="gap-2 px-4"><Text className="text-display text-ink-950">{t("nav.wishlist")}</Text>{error ? <Text className="text-body-sm text-ink-500">{t("home.loadError")}</Text> : null}</View>}
        ListEmptyComponent={error ? null :
          <View className="flex-1 items-center justify-center gap-2 px-6 py-16">
            <Text className="text-h2 text-ink-950">{t("wishlist.empty")}</Text>
            <Text className="text-center text-body-sm text-ink-500">
              {t("wishlist.emptyHint")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-1">
            <ProductCard
              product={toProductCardData(item, t, formatPrice)}
              onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("wishlist.remove")}
              onPress={() => onRemove(item.productCode)}
              disabled={removingCode === item.productCode}
              className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/90"
            >
              <ThemedIcon name="heart" size={18} />
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
