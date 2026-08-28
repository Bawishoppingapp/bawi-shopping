import { StatusBadge, ThemedActivityIndicator, useThemeColors } from "@bawi/mobile-ui";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type ReturnRequest, listReturnRequests } from "@/features/returns/services/returns-client";
import { returnReasonLabel, returnStatusBadge } from "@/features/returns/utils/status";
import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";

export default function SellReturnsScreen() {
  const themeColors = useThemeColors();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getSellerSessionToken();
    if (!token) return;
    const result = await listReturnRequests(token);
    setReturns(result);
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
        <Stack.Screen options={{ headerShown: true, title: "Returns" }} />
        <ThemedActivityIndicator />
      </SafeAreaView>
    );
  }

  if (returns.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <Stack.Screen options={{ headerShown: true, title: "Returns" }} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-h2 text-ink-950">No return requests</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Returns" }} />
      <FlatList
        data={returns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.ink950} />}
        renderItem={({ item }) => {
          const badge = returnStatusBadge(item.status);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/sell/returns/[id]", params: { id: item.id } })}
              className="gap-2 rounded-md border border-ink-100 p-4 active:bg-ink-100"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-body-sm font-medium text-ink-950">{returnReasonLabel(item.reason)}</Text>
                <StatusBadge label={badge.label} tone={badge.tone} />
              </View>
              <Text className="text-caption text-ink-500">
                Requested {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
