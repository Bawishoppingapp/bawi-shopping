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
      }}
    />
  );
}
