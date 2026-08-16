import { Button, StatusBadge } from "@bawi/mobile-ui";
import { Image } from "expo-image";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, Text, View } from "react-native";

import { type SellerProductSummary, listMyProducts } from "@/features/seller-products/services/seller-products-client";
import { productStatusBadge } from "@/features/seller-products/utils/status";
import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";

export default function SellProductsScreen() {
  const [products, setProducts] = useState<SellerProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getSellerSessionToken();
    if (!token) return;
    const result = await listMyProducts(token);
    setProducts(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ headerShown: true, title: "Products" }} />
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Products" }} />
      <FlatList
        data={products}
        keyExtractor={(item) => item.listing.id}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#151210" />}
        ListHeaderComponent={
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-h1 text-ink-950">Products</Text>
            <Button onPress={() => router.push("/(tabs)/sell/products/new")}>New</Button>
          </View>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center gap-4 py-16">
            <Text className="text-h2 text-ink-950">No products yet</Text>
            <Text className="text-center text-body-sm text-ink-500">
              Create your first product to start selling on Bawi.
            </Text>
            <Button onPress={() => router.push("/(tabs)/sell/products/new")}>Create a product</Button>
          </View>
        }
        renderItem={({ item }) => {
          const badge = productStatusBadge(item.listing.status);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/(tabs)/sell/products/[id]", params: { id: item.listing.id } })}
              className="flex-row items-center gap-3 rounded-md border border-ink-100 p-3 active:bg-ink-100"
            >
              <View className="h-16 w-14 overflow-hidden rounded-md bg-ink-100">
                {item.product?.thumbnail ? (
                  <Image
                    source={{ uri: item.product.thumbnail }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : null}
              </View>
              <View className="flex-1 gap-1">
                <Text numberOfLines={1} className="text-body-sm font-medium text-ink-950">
                  {item.product?.title ?? "Untitled product"}
                </Text>
                <Text className="text-caption text-ink-500">{item.listing.product_code}</Text>
              </View>
              <StatusBadge label={badge.label} tone={badge.tone} />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
