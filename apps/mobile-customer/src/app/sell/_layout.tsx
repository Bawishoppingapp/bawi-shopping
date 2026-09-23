import { useThemeColors } from "@bawi/mobile-ui";
import { Stack } from "expo-router";

export default function SellLayout() {
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
      <Stack.Screen name="index" options={{ title: "Sell on Bawi" }} />
      <Stack.Screen name="pitch" options={{ title: "Sell on Bawi" }} />
      <Stack.Screen name="apply" options={{ title: "Apply to sell" }} />
      <Stack.Screen name="status" options={{ title: "Application status" }} />
      <Stack.Screen name="activate" options={{ title: "Activate storefront" }} />
      <Stack.Screen name="login" options={{ title: "Seller log in" }} />
      <Stack.Screen name="dashboard" options={{ title: "Seller dashboard" }} />
      <Stack.Screen name="products" options={{ title: "Products" }} />
      <Stack.Screen name="fulfillment" options={{ title: "Fulfillment" }} />
      <Stack.Screen name="returns" options={{ title: "Returns" }} />
      <Stack.Screen name="finance" options={{ title: "Finance" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
      <Stack.Screen name="team" options={{ title: "Team" }} />
    </Stack>
  );
}
