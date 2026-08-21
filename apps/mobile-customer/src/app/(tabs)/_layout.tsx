import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { useTranslations } from "@/features/i18n/hooks/use-locale";

const ICON_SIZE = 24;

export default function TabsLayout() {
  const t = useTranslations();

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
          title: t("nav.home"),
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("nav.search"),
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t("nav.cart"),
          tabBarIcon: ({ color }) => <Ionicons name="bag-outline" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          // No dedicated catalog key yet - Wishlist is a mobile-only
          // concept the web nav never had (see CLAUDE.md's mobile
          // section). Left in English rather than guessing a
          // translation for a genuinely new term.
          title: "Wishlist",
          tabBarIcon: ({ color }) => <Ionicons name="heart-outline" size={ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t("nav.account"),
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}
