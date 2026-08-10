import { Button } from "@bawi/mobile-ui";
import { router } from "expo-router";
import { SafeAreaView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";

/**
 * Placeholder content, but the real auth-gating logic - real order list
 * (store/orders, store/orders/[id]) built in a follow-up slice.
 */
export default function OrdersScreen() {
  const { customer, isLoading } = useAuth();

  if (!isLoading && !customer) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-body text-ink-500">Log in to see your orders.</Text>
          <Button onPress={() => router.push("/login")}>Log in</Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-h2 text-ink-950">Orders</Text>
      </View>
    </SafeAreaView>
  );
}
