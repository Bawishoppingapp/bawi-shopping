import { useThemeColors } from "@bawi/mobile-ui";
import { Stack } from "expo-router";

export default function AccountLayout() {
  const themeColors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: themeColors.surface },
        headerTintColor: themeColors.ink950,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Account" }} />
      <Stack.Screen name="orders" options={{ title: "Orders" }} />
      <Stack.Screen name="addresses" options={{ title: "Addresses" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="language" options={{ title: "Language" }} />
      <Stack.Screen name="currency" options={{ title: "Currency" }} />
      <Stack.Screen name="legal/[slug]" options={{ title: "Legal" }} />
    </Stack>
  );
}
