import { Button, StatusBadge, ThemedActivityIndicator, useThemeColors } from "@bawi/mobile-ui";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  clearPendingApplicationId,
  getPendingApplicationId,
} from "@/features/seller-application/services/pending-application-storage";
import {
  type SellerApplicationSummary,
  getSellerApplicationStatus,
} from "@/features/seller-application/services/seller-application-client";

function statusBadge(status: string): { label: string; tone: "neutral" | "warning" | "success" | "danger" } {
  switch (status) {
    case "submitted":
    case "under_review":
      return { label: "Under review", tone: "warning" };
    case "approved":
      return { label: "Approved", tone: "success" };
    case "rejected":
      return { label: "Not approved", tone: "danger" };
    case "withdrawn":
      return { label: "Withdrawn", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}

export default function SellStatusScreen() {
  const themeColors = useThemeColors();
  const [application, setApplication] = useState<SellerApplicationSummary | null | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const id = await getPendingApplicationId();
    if (!id) {
      setApplication(null);
      return;
    }
    const result = await getSellerApplicationStatus(id);
    if (!result) {
      // Application no longer exists (e.g. withdrawn and cleared server-side) -
      // drop the stale pending id rather than keep polling a dead reference.
      await clearPendingApplicationId();
    }
    setApplication(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function onApplyAgain() {
    await clearPendingApplicationId();
    router.replace("/sell/apply");
  }

  useEffect(() => {
    if (application === null) {
      router.replace("/sell/pitch");
    }
  }, [application]);

  if (application === undefined || application === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ThemedActivityIndicator />
      </SafeAreaView>
    );
  }

  const badge = statusBadge(application.status);
  const isPending = application.status === "submitted" || application.status === "under_review";
  const isApproved = application.status === "approved";
  const isClosed = application.status === "rejected" || application.status === "withdrawn";

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.ink950} />}
      >
        <View className="items-center gap-3">
          <StatusBadge label={badge.label} tone={badge.tone} />
          <Text className="text-center text-h1 text-ink-950">{application.store_name}</Text>
        </View>

        {isPending ? (
          <Text className="text-center text-body text-ink-500">
            We&apos;re reviewing your application. This usually takes a couple of business days - pull to
            refresh, or check back later.
          </Text>
        ) : null}

        {isApproved ? (
          <View className="gap-4">
            <Text className="text-center text-body text-ink-500">
              Your storefront application was approved. Activate your account to start listing
              products.
            </Text>
            <Button onPress={() => router.push("/sell/activate")}>Activate my storefront</Button>
          </View>
        ) : null}

        {isClosed ? (
          <View className="gap-4">
            <Text className="text-center text-body text-ink-500">
              This application wasn&apos;t approved. You can submit a new application whenever
              you&apos;re ready.
            </Text>
            <Button variant="secondary" onPress={onApplyAgain}>
              Apply again
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
