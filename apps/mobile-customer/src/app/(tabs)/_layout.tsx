import { useThemeColors } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { StyleSheet, useColorScheme } from "react-native";

import { useTranslations } from "@/features/i18n/hooks/use-locale";

const ICON_SIZE = 24;

export default function TabsLayout() {
  const t = useTranslations();
  const themeColors = useThemeColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: themeColors.ink950,
        tabBarInactiveTintColor: themeColors.ink400,
        // Floating/translucent tab bar - the bar sits above scrolling
        // content instead of pushing it up, so each tab screen adds its
        // own bottom inset via useBottomTabBarHeight() to keep content
        // clear of the glass. Border replaces the old opaque
        // backgroundColor's implicit separation from content behind it.
        tabBarStyle: { position: "absolute", borderTopColor: isDark ? "#3A352E" : "#E3DCD1" },
        tabBarBackground: () => (
          <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        ),
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
