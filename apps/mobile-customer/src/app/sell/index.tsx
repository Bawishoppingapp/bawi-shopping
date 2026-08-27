import { ThemedActivityIndicator } from "@bawi/mobile-ui";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { getPendingApplicationId } from "@/features/seller-application/services/pending-application-storage";
import { useSellerAuth } from "@/features/seller-auth/hooks/use-seller-auth";

// Gatekeeper only - no persistent UI. Resolves seller state on every focus
// (not just mount) and routes to the right screen: an active seller session
// wins outright; otherwise a locally-stored pending application id sends
// the user to the status screen; otherwise the pitch screen.
export default function SellGatekeeperScreen() {
  const { seller, isLoading: sellerAuthLoading } = useSellerAuth();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (sellerAuthLoading) return;
        if (seller) {
          router.replace("/sell/dashboard");
          return;
        }
        const pendingId = await getPendingApplicationId();
        if (cancelled) return;
        router.replace(pendingId ? "/sell/status" : "/sell/pitch");
      })();
      return () => {
        cancelled = true;
      };
    }, [seller, sellerAuthLoading])
  );

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-paper">
      <ThemedActivityIndicator />
    </SafeAreaView>
  );
}
