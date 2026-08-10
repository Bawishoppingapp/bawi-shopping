import { SafeAreaView, Text, View } from "react-native";

/**
 * Placeholder - real dashboard (what needs attention, what needs
 * preparing/pickup, sales performance, balance) built in Slice 2.
 * Deliberately operational/utilitarian, not fashion-forward - this app
 * shares Bawi's brand but not the customer app's merchandising energy
 * (see the mobile design brief).
 */
export default function DashboardScreen() {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-1 items-center justify-center gap-2 px-6">
        <Text className="text-h1 text-ink-950">Bawi Seller</Text>
        <Text className="text-body text-ink-500">Dashboard</Text>
      </View>
    </SafeAreaView>
  );
}
