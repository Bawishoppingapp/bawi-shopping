import { ThemedActivityIndicator, useThemeColors } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSessionToken } from "@/features/auth/services/token-storage";
import { notificationEventBadge } from "@/features/notifications/utils/event-labels";
import {
  type NotificationEntry,
  listNotifications,
  markNotificationRead,
} from "@/features/notifications/services/notifications-client";
import { useLocale, useTranslations } from "@/features/i18n/hooks/use-locale";

export default function NotificationsScreen() {
  const themeColors = useThemeColors();
  const locale = useLocale();
  const t = useTranslations();
  const tabBarHeight = useBottomTabBarHeight();
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const token = await getSessionToken();
    const result = await listNotifications(token);
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
    const token = await getSessionToken();
    await markNotificationRead(token, entry.id);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ headerShown: true, title: t("account.notifications") }} />
        <ThemedActivityIndicator />
      </SafeAreaView>
    );
  }

  if (notifications.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <Stack.Screen options={{ headerShown: true, title: t("account.notifications") }} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-h2 text-ink-950">{t("notifications.empty")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: t("account.notifications") }} />
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.ink950} />}
        renderItem={({ item }) => {
          const unread = !item.read_at;
          const badge = notificationEventBadge(item.event_type, t);
          const hasLocalizedCopy = badge.label !== item.event_type;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => onPressEntry(item)}
              className={`gap-1 rounded-md border p-4 ${unread ? "border-ink-950 bg-ink-100" : "border-ink-100"}`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  {unread ? <View className="h-2 w-2 rounded-full bg-ink-solid" /> : null}
                  <Text className={`text-body-sm ${unread ? "font-semibold" : "font-medium"} text-ink-950`}>
                    {hasLocalizedCopy ? badge.label : item.subject}
                  </Text>
                </View>
                <Text className="text-caption uppercase text-ink-500">{badge.label}</Text>
              </View>
              <Text className="text-body-sm text-ink-700">
                {hasLocalizedCopy ? t("notifications.updateBody") : item.body}
              </Text>
              <Text className="text-caption text-ink-500">
                {new Date(item.created_at).toLocaleDateString(locale)}
              </Text>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}
