import { Button, StatusBadge, useThemeColors } from "@bawi/mobile-ui";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Stack, router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSessionToken } from "@/features/auth/services/token-storage";
import {
  AddressesClientError,
  type CustomerAddress,
  deleteAddress,
  listAddresses,
} from "@/features/addresses/services/addresses-client";
import { countryName } from "@/features/addresses/data/countries";

export default function AddressesScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const themeColors = useThemeColors();
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
        <ActivityIndicator color={themeColors.ink950} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Addresses" }} />
      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 16, gap: 12, flexGrow: 1 }}
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
              {[
                item.metadata?.sub_city,
                item.metadata?.woreda ? `Woreda ${item.metadata.woreda}` : null,
                item.city,
                item.province,
                item.postal_code,
                countryName(item.country_code),
              ]
                .filter(Boolean)
                .join(", ")}
            </Text>
            {item.metadata?.landmark ? (
              <Text className="text-caption text-ink-500">Near {item.metadata.landmark}</Text>
            ) : null}
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
