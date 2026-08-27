import { Button } from "@bawi/mobile-ui";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/features/auth/hooks/use-auth";

export default function SellPitchScreen() {
  const { customer } = useAuth();

  function onCreateStorefront() {
    if (!customer) {
      router.push("/login");
      return;
    }
    router.push("/sell/apply");
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 20 }}>
        <View className="gap-2">
          <Text className="text-caption font-medium uppercase text-ink-500">Sell with Bawi</Text>
          <Text className="text-h1 text-ink-950">Turn your closet into a storefront.</Text>
          <Text className="text-body text-ink-500">
            List clothing and accessories, reach shoppers across the marketplace, and get paid -
            Bawi handles checkout, tracking, and customer service.
          </Text>
        </View>
        <Button onPress={onCreateStorefront}>Create my storefront</Button>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/sell/login")}
          className="items-center py-2"
        >
          <Text className="text-body-sm text-ink-500">
            Already have a seller account? <Text className="font-medium text-ink-950">Log in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
