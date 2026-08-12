import { Button, StatusBadge } from "@bawi/mobile-ui";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";

export default function DashboardScreen() {
  const { seller, logout } = useAuth();

  if (!seller) return null;

  const stripeReady = seller.seller.stripe.charges_enabled && seller.seller.stripe.payouts_enabled;

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View className="gap-1">
          <Text className="text-caption uppercase tracking-wide text-ink-500">Signed in as</Text>
          <Text className="text-h1 text-ink-950">{seller.seller.name}</Text>
        </View>

        <View className="gap-2 rounded-md border border-ink-100 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-body-sm font-medium text-ink-950">Stripe payouts</Text>
            <StatusBadge
              label={stripeReady ? "Ready" : "Setup needed"}
              tone={stripeReady ? "success" : "warning"}
            />
          </View>
          {!stripeReady ? (
            <Text className="text-body-sm text-ink-500">
              Finish connecting Stripe from the Bawi seller website to receive payouts.
            </Text>
          ) : null}
        </View>

        <View className="rounded-md border border-ink-100 p-4">
          <Text className="text-body-sm text-ink-500">
            Fulfillment, finance, and returns are coming to this app in a future update. Manage them
            from the Bawi seller website for now.
          </Text>
        </View>

        <Button variant="secondary" onPress={logout}>
          Log out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
