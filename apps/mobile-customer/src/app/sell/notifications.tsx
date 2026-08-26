import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, SafeAreaView, Text, View } from "react-native";

import { notificationEventBadge } from "@/features/notifications/utils/event-labels";
import {
  type NotificationEntry,
  listSellerNotifications,
  markSellerNotificationRead,
} from "@/features/notifications/services/seller-notifications-client";
import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";

export default function SellNotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getSellerSessionToken();
    const result = await listSellerNotifications(token);
    setNotifications(result);
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

  async function onPressEntry(entry: NotificationEntry) {
    if (entry.read_at) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === entry.id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    const token = await getSellerSessionToken();
    await markSellerNotificationRead(token, entry.id);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ headerShown: true, title: "Notifications" }} />
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  if (notifications.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <Stack.Screen options={{ headerShown: true, title: "Notifications" }} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-h2 text-ink-950">No notifications yet</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Notifications" }} />
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#151210" />}
        renderItem={({ item }) => {
          const unread = !item.read_at;
          const badge = notificationEventBadge(item.event_type);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => onPressEntry(item)}
              className={`gap-1 rounded-md border p-4 ${unread ? "border-ink-950 bg-ink-100" : "border-ink-100"}`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  {unread ? <View className="h-2 w-2 rounded-full bg-ink-950" /> : null}
                  <Text className={`text-body-sm ${unread ? "font-semibold" : "font-medium"} text-ink-950`}>
                    {item.subject}
                  </Text>
                </View>
                <Text className="text-caption uppercase text-ink-500">{badge.label}</Text>
              </View>
              <Text className="text-body-sm text-ink-700">{item.body}</Text>
              <Text className="text-caption text-ink-500">
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
