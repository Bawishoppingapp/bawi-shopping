import { SafeAreaView, Text, View } from "react-native";

/**
 * Placeholder - real home feed (hero/campaign, categories, new arrivals,
 * recommendations) built in Slice 1, see docs/... task tracker. This
 * confirms the app boots with real Bawi branding rather than the Expo
 * starter template.
 */
export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-1 items-center justify-center gap-2 px-6">
        <Text className="text-display text-ink-950">Bawi</Text>
        <Text className="text-body text-ink-500">Fashion, from independent brands.</Text>
      </View>
    </SafeAreaView>
  );
}
