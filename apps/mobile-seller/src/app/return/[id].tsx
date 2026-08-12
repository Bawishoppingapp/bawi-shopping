import { Button, Input, StatusBadge } from "@bawi/mobile-ui";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { getSessionToken } from "@/features/auth/services/token-storage";
import {
  type ReturnRequest,
  ReturnsClientError,
  approveReturnRequest,
  denyReturnRequest,
  getReturnRequest,
} from "@/features/returns/services/returns-client";
import { returnReasonLabel, returnStatusBadge } from "@/features/returns/utils/status";

export default function ReturnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [returnRequest, setReturnRequest] = useState<ReturnRequest | null | undefined>(undefined);
  const [denyReason, setDenyReason] = useState("");
  const [denyReasonError, setDenyReasonError] = useState<string | null>(null);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getSessionToken();
    if (!token) return;
    const result = await getReturnRequest(token, id).catch(() => null);
    setReturnRequest(result);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onApprove() {
    const token = await getSessionToken();
    if (!token) return;
    setActionError(null);
    setUpdating(true);
    try {
      const result = await approveReturnRequest(token, id);
      setReturnRequest(result);
    } catch (error) {
      setActionError(error instanceof ReturnsClientError ? error.message : "Something went wrong.");
    } finally {
      setUpdating(false);
    }
  }

  async function onDeny() {
    if (denyReason.trim().length === 0) {
      setDenyReasonError("Tell the customer why you're denying this return.");
      return;
    }
    setDenyReasonError(null);
    const token = await getSessionToken();
    if (!token) return;
    setActionError(null);
    setUpdating(true);
    try {
      const result = await denyReturnRequest(token, id, denyReason.trim());
      setReturnRequest(result);
    } catch (error) {
      setActionError(error instanceof ReturnsClientError ? error.message : "Something went wrong.");
    } finally {
      setUpdating(false);
    }
  }

  if (returnRequest === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#151210" />
      </View>
    );
  }

  if (returnRequest === null) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-paper px-6">
        <Stack.Screen options={{ title: "Return" }} />
        <Text className="text-h2 text-ink-950">Not found</Text>
      </View>
    );
  }

  const badge = returnStatusBadge(returnRequest.status);
  const canAct = returnRequest.status === "requested";

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen options={{ title: "Return request" }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-h1 text-ink-950">{returnReasonLabel(returnRequest.reason)}</Text>
          <StatusBadge label={badge.label} tone={badge.tone} />
        </View>
        <Text className="text-caption text-ink-500">
          Requested {new Date(returnRequest.created_at).toLocaleDateString()}
        </Text>

        {returnRequest.customer_comment ? (
          <View className="gap-1 rounded-md border border-ink-100 p-4">
            <Text className="text-body-sm font-medium text-ink-800">Customer&apos;s note</Text>
            <Text className="text-body text-ink-700">{returnRequest.customer_comment}</Text>
          </View>
        ) : null}

        {returnRequest.seller_response ? (
          <View className="gap-1 rounded-md border border-ink-100 p-4">
            <Text className="text-body-sm font-medium text-ink-800">Your response</Text>
            <Text className="text-body text-ink-700">{returnRequest.seller_response}</Text>
          </View>
        ) : null}

        {actionError ? <Text className="text-body-sm text-danger">{actionError}</Text> : null}

        {canAct ? (
          showDenyForm ? (
            <View className="gap-3">
              <Input
                label="Reason for denying"
                value={denyReason}
                onChangeText={setDenyReason}
                error={denyReasonError ?? undefined}
                multiline
                numberOfLines={3}
              />
              <Button variant="destructive" onPress={onDeny} loading={updating}>
                Confirm deny
              </Button>
              <Button variant="ghost" onPress={() => setShowDenyForm(false)}>
                Cancel
              </Button>
            </View>
          ) : (
            <View className="gap-3">
              <Button onPress={onApprove} loading={updating}>
                Approve return
              </Button>
              <Button variant="secondary" onPress={() => setShowDenyForm(true)} disabled={updating}>
                Deny return
              </Button>
            </View>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}
