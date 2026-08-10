import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

const ICON_SIZE = 24;

export default function TabsLayout() {
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
          title: "Home",
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color }) => <Ionicons name="bag-outline" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => <Ionicons name="receipt-outline" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}
