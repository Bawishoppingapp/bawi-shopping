import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";

const ICON_SIZE = 24;

export default function TabsLayout() {
  const { seller, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#151210" />
      </View>
    );
  }

  if (!seller) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#151210",
        tabBarInactiveTintColor: "#8C8175",
        tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#E3DCD1" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}
