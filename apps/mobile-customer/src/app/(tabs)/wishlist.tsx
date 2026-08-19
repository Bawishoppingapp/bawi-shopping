import { SafeAreaView, Text, View } from "react-native";

// Stub for Slice A - Slice C replaces this with the real saved-products
// list wired to the new /store/wishlist backend module.
export default function WishlistScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-1 items-center justify-center gap-2 px-6">
        <Text className="text-h1 text-ink-950">Wishlist</Text>
        <Text className="text-body text-ink-500">Coming soon.</Text>
      </View>
    </SafeAreaView>
  );
}
