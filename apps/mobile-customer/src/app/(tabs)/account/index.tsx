import { Button, Card } from "@bawi/mobile-ui";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";

export default function AccountScreen() {
  const { customer, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-1 justify-center gap-4 px-6">
          <View className="gap-1">
            <Text className="text-h1 text-ink-950">Your account</Text>
            <Text className="text-body text-ink-500">Log in to view orders, save favorites, and check out faster.</Text>
          </View>
          <Button onPress={() => router.push("/login")}>Log in</Button>
          <Button variant="secondary" onPress={() => router.push("/register")}>
            Create account
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="gap-4 px-6 pt-6">
        <View className="gap-1">
          <Text className="text-h1 text-ink-950">
            {customer.first_name ? `Hi, ${customer.first_name}` : "Your account"}
          </Text>
          <Text className="text-body text-ink-500">{customer.email}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/account/orders")}>
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="text-body-sm font-medium text-ink-950">My Orders</Text>
              <Text className="text-body-sm text-ink-500">{">"}</Text>
            </View>
          </Card>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/account/addresses")}>
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="text-body-sm font-medium text-ink-950">Addresses</Text>
              <Text className="text-body-sm text-ink-500">{">"}</Text>
            </View>
          </Card>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/account/notifications")}>
          <Card>
            <View className="flex-row items-center justify-between">
              <Text className="text-body-sm font-medium text-ink-950">Notifications</Text>
              <Text className="text-body-sm text-ink-500">{">"}</Text>
            </View>
          </Card>
        </Pressable>
        <Button variant="secondary" onPress={() => logout()}>
          Log out
        </Button>
      </View>
    </SafeAreaView>
  );
}
