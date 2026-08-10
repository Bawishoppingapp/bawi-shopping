import { SafeAreaView, Text, View } from "react-native";

/**
 * Placeholder - real guest/customer cart built in a follow-up slice
 * (store/cart, store/cart/items, merge-on-login).
 */
export default function CartScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-h2 text-ink-950">Cart</Text>
      </View>
    </SafeAreaView>
  );
}
