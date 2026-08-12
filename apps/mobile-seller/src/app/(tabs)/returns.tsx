import { StatusBadge } from "@bawi/mobile-ui";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, Text, View } from "react-native";

import { getSessionToken } from "@/features/auth/services/token-storage";
import { type ReturnRequest, listReturnRequests } from "@/features/returns/services/returns-client";
import { returnReasonLabel, returnStatusBadge } from "@/features/returns/utils/status";

export default function ReturnsScreen() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getSessionToken();
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
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  if (returns.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-h2 text-ink-950">No return requests</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <FlatList
        data={returns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#151210" />}
        ListHeaderComponent={<Text className="mb-2 text-h1 text-ink-950">Returns</Text>}
        renderItem={({ item }) => {
          const badge = returnStatusBadge(item.status);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/return/[id]", params: { id: item.id } })}
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
