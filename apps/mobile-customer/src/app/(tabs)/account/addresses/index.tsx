import { Button, StatusBadge } from "@bawi/mobile-ui";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, SafeAreaView, Text, View } from "react-native";

import { getSessionToken } from "@/features/auth/services/token-storage";
import {
  AddressesClientError,
  type CustomerAddress,
  deleteAddress,
  listAddresses,
} from "@/features/addresses/services/addresses-client";

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getSessionToken();
    const result = await listAddresses(token);
    setAddresses(result);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  function confirmDelete(address: CustomerAddress) {
    Alert.alert("Remove this address?", `${address.address_1}, ${address.city}`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setDeletingId(address.id);
          try {
            const token = await getSessionToken();
            await deleteAddress(token, address.id);
            await load();
          } catch (error) {
            Alert.alert(
              "Couldn't remove address",
              error instanceof AddressesClientError ? error.message : "Something went wrong."
            );
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Stack.Screen options={{ headerShown: true, title: "Addresses" }} />
        <ActivityIndicator color="#151210" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Addresses" }} />
      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        ListHeaderComponent={
          <Button className="mb-2" onPress={() => router.push("/(tabs)/account/addresses/new")}>
            + Add address
          </Button>
        }
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center gap-2 py-16">
            <Text className="text-h2 text-ink-950">No saved addresses</Text>
            <Text className="text-center text-body-sm text-ink-500">
              Add one to check out faster next time.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="gap-2 rounded-md border border-ink-100 p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-body-sm font-medium text-ink-950">
                {item.first_name} {item.last_name}
              </Text>
              {item.is_default_shipping ? <StatusBadge label="Default" tone="info" /> : null}
            </View>
            <Text className="text-body-sm text-ink-700">
              {item.address_1}
              {item.address_2 ? `, ${item.address_2}` : ""}
            </Text>
            <Text className="text-body-sm text-ink-700">
              {[item.city, item.province, item.postal_code].filter(Boolean).join(", ")}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => confirmDelete(item)}
              disabled={deletingId === item.id}
              className="self-start py-1"
            >
              <Text className="text-caption text-danger">
                {deletingId === item.id ? "Removing…" : "Remove"}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
