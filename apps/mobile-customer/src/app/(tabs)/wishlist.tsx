import { Button, ProductCard } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import type { ProductHit } from "@/features/discovery/services/discovery-client";
import { toProductCardData } from "@/features/discovery/utils/to-product-card";
import { listWishlist, removeFromWishlist } from "@/features/wishlist/services/wishlist-client";

export default function WishlistScreen() {
  const { customer, isLoading: authLoading } = useAuth();
  const [products, setProducts] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingCode, setRemovingCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getSessionToken();
    const result = await listWishlist(token);
    setProducts(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (authLoading || !customer) {
        setLoading(false);
        return;
      }
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [authLoading, customer, load])
  );

  async function onRemove(productCode: string) {
    setRemovingCode(productCode);
    const token = await getSessionToken();
    const ok = await removeFromWishlist(productCode, token);
    if (ok) {
      setProducts((prev) => prev.filter((p) => p.productCode !== productCode));
    }
    setRemovingCode(null);
  }

  if (!authLoading && !customer) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 justify-center gap-4 px-6">
          <View className="gap-1">
            <Text className="text-h1 text-ink-950">Wishlist</Text>
            <Text className="text-body text-ink-500">Log in to save products for later.</Text>
          </View>
          <Button onPress={() => router.push("/login")}>Log in</Button>
          <Button variant="secondary" onPress={() => router.push("/register")}>
            Create account
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  if (authLoading || loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <FlatList
        data={products}
        keyExtractor={(item) => item.productCode}
        numColumns={2}
        columnWrapperStyle={{ gap: 16, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 16, paddingTop: 8, paddingBottom: 32 }}
        ListHeaderComponent={<Text className="px-4 text-display text-ink-950">Wishlist</Text>}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center gap-2 px-6 py-16">
            <Text className="text-h2 text-ink-950">Nothing saved yet</Text>
            <Text className="text-center text-body-sm text-ink-500">
              Tap the heart on a product to save it here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-1">
            <ProductCard
              product={toProductCardData(item)}
              onPress={() => router.push({ pathname: "/product/[code]", params: { code: item.productCode } })}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove from wishlist"
              onPress={() => onRemove(item.productCode)}
              disabled={removingCode === item.productCode}
              className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/90"
            >
              <Ionicons name="heart" size={18} color="#151210" />
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
