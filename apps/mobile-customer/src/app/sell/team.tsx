import { Button, Input, StatusBadge } from "@bawi/mobile-ui";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";

import { useSellerAuth } from "@/features/seller-auth/hooks/use-seller-auth";
import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";
import {
  ROLE_LABELS,
  STAFF_ROLES,
  StaffClientError,
  type StaffMember,
  type StaffRole,
  inviteStaff,
  listStaff,
  removeStaff,
} from "@/features/staff/services/staff-client";

function RoleChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`rounded-full border px-3 py-2 ${selected ? "border-ink-950 bg-ink-950" : "border-ink-200 bg-white"}`}
    >
      <Text className={`text-body-sm ${selected ? "text-white" : "text-ink-950"}`}>{label}</Text>
    </Pressable>
  );
}

export default function TeamScreen() {
  const { seller } = useSellerAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("catalog_manager");
  const [inviting, setInviting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isOwner = seller?.seller_user.role === "owner";

  const load = useCallback(async () => {
    const token = await getSellerSessionToken();
    if (!token) return;
    try {
      setStaff(await listStaff(token));
    } catch {
      // Leave the last-known list in place on a transient error.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  async function onInvite() {
    setFormError(null);
    if (!email.trim()) {
      setFormError("Enter an email address");
      return;
    }
    setInviting(true);
    try {
      const token = await getSellerSessionToken();
      if (!token) throw new StaffClientError("You're not signed in.");
      await inviteStaff(token, email.trim(), role);
      setEmail("");
      await load();
    } catch (error) {
      setFormError(error instanceof StaffClientError ? error.message : "Something went wrong.");
    } finally {
      setInviting(false);
    }
  }

  function confirmRemove(member: StaffMember) {
    Alert.alert("Remove team member?", member.email, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getSellerSessionToken();
            if (!token) return;
            await removeStaff(token, member.id);
            await load();
          } catch (error) {
            Alert.alert(
              "Couldn't remove",
              error instanceof StaffClientError ? error.message : "Something went wrong."
            );
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ headerShown: true, title: "Team" }} />
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Team" }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View className="gap-3">
          {staff.map((member) => (
            <View key={member.id} className="gap-2 rounded-md border border-ink-100 p-4">
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 text-body-sm font-medium text-ink-950">{member.email}</Text>
                <StatusBadge label={member.activated ? "Live" : "Pending"} tone={member.activated ? "success" : "warning"} />
              </View>
              <Text className="text-body-sm text-ink-500">{ROLE_LABELS[member.role] ?? member.role}</Text>
              {isOwner && member.role !== "owner" ? (
                <Pressable accessibilityRole="button" onPress={() => confirmRemove(member)} className="self-start py-1">
                  <Text className="text-caption text-danger">Remove</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>

        {isOwner ? (
          <View className="gap-3 border-t border-ink-100 pt-4">
            <Text className="text-h3 text-ink-950">Invite a team member</Text>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              error={formError ?? undefined}
            />
            <View className="gap-2">
              <Text className="text-body-sm font-medium text-ink-800">Role</Text>
              <View className="flex-row flex-wrap gap-2">
                {STAFF_ROLES.map((r) => (
                  <RoleChip key={r} label={ROLE_LABELS[r]} selected={role === r} onPress={() => setRole(r)} />
                ))}
              </View>
            </View>
            <Button onPress={onInvite} loading={inviting}>
              Send invite
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
