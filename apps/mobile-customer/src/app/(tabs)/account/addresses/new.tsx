import { Button, Input } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { getSessionToken } from "@/features/auth/services/token-storage";
import {
  AddressesClientError,
  createAddress,
} from "@/features/addresses/services/addresses-client";
import { addressSchema } from "@/features/addresses/schemas/address-schema";

export default function NewAddressScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("us");
  const [phone, setPhone] = useState("");
  const [isDefaultShipping, setIsDefaultShipping] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = addressSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      address_1: addressLine1,
      address_2: addressLine2,
      city,
      province,
      postal_code: postalCode,
      country_code: countryCode,
      phone,
      is_default_shipping: isDefaultShipping,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const token = await getSessionToken();
      await createAddress(token, { ...parsed.data, country_code: parsed.data.country_code.toLowerCase() });
      router.back();
    } catch (error) {
      setFormError(
        error instanceof AddressesClientError ? error.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "New address" }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}

        <Input label="First name" value={firstName} onChangeText={setFirstName} error={fieldErrors.first_name} />
        <Input label="Last name" value={lastName} onChangeText={setLastName} error={fieldErrors.last_name} />
        <Input label="Address line 1" value={addressLine1} onChangeText={setAddressLine1} error={fieldErrors.address_1} />
        <Input label="Address line 2 (optional)" value={addressLine2} onChangeText={setAddressLine2} />
        <Input label="City" value={city} onChangeText={setCity} error={fieldErrors.city} />
        <Input label="State" value={province} onChangeText={setProvince} error={fieldErrors.province} />
        <Input
          label="Postal code"
          value={postalCode}
          onChangeText={setPostalCode}
          error={fieldErrors.postal_code}
          keyboardType="number-pad"
        />
        <Input
          label="Country"
          value={countryCode}
          onChangeText={setCountryCode}
          error={fieldErrors.country_code}
          autoCapitalize="none"
        />
        <Input
          label="Phone (optional)"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDefaultShipping }}
          onPress={() => setIsDefaultShipping((v) => !v)}
          className="flex-row items-center gap-2 py-2"
        >
          <Ionicons name={isDefaultShipping ? "checkbox" : "square-outline"} size={22} color="#151210" />
          <Text className="text-body-sm text-ink-700">Set as default shipping address</Text>
        </Pressable>

        <Button onPress={onSubmit} loading={submitting}>
          Save address
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
