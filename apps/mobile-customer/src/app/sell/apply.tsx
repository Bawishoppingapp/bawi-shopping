import { Button, Input } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  BUSINESS_TYPES,
  PRODUCT_CATEGORIES,
  applicationSchema,
} from "@/features/seller-application/schemas/application-schema";
import { setPendingApplicationId } from "@/features/seller-application/services/pending-application-storage";
import {
  SellerApplicationError,
  submitSellerApplication,
} from "@/features/seller-application/services/seller-application-client";

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
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

export default function SellApplyScreen() {
  const { customer } = useAuth();

  const [legalBusinessName, setLegalBusinessName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState<"usd" | "etb" | null>(null);
  const [contactFirstName, setContactFirstName] = useState(customer?.first_name ?? "");
  const [contactLastName, setContactLastName] = useState(customer?.last_name ?? "");
  const [businessEmail, setBusinessEmail] = useState(customer?.email ?? "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [businessDescription, setBusinessDescription] = useState("");
  const [estimatedProductCount, setEstimatedProductCount] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleCategory(category: string) {
    setProductCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  }

  async function onSubmit() {
    setFormError(null);
    const parsed = applicationSchema.safeParse({
      legal_business_name: legalBusinessName,
      store_name: storeName,
      business_type: businessType,
      currency_code: currencyCode,
      contact_first_name: contactFirstName,
      contact_last_name: contactLastName,
      business_email: businessEmail,
      phone_number: phoneNumber,
      website_url: websiteUrl,
      address_line1: addressLine1,
      address_line2: addressLine2,
      address_city: addressCity,
      address_state: addressState,
      address_postal_code: addressPostalCode,
      product_categories: productCategories,
      business_description: businessDescription,
      estimated_product_count: estimatedProductCount,
      agreed_to_terms: agreedToTerms,
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
      const application = await submitSellerApplication(parsed.data);
      await setPendingApplicationId(application.id);
      router.replace("/sell/status");
    } catch (error) {
      setFormError(
        error instanceof SellerApplicationError ? error.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Apply to sell" }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}

        <Text className="text-h2 text-ink-950">About your business</Text>
        <Input label="Legal business name" value={legalBusinessName} onChangeText={setLegalBusinessName} error={fieldErrors.legal_business_name} />
        <Input label="Store name" value={storeName} onChangeText={setStoreName} error={fieldErrors.store_name} helperText="This is what shoppers will see." />

        <View className="gap-2">
          <Text className="text-body-sm font-medium text-ink-800">Business type</Text>
          <View className="flex-row flex-wrap gap-2">
            {BUSINESS_TYPES.map((type) => (
              <Chip key={type.value} label={type.label} selected={businessType === type.value} onPress={() => setBusinessType(type.value)} />
            ))}
          </View>
          {fieldErrors.business_type ? <Text className="text-body-sm text-danger">{fieldErrors.business_type}</Text> : null}
        </View>

        <View className="gap-2">
          <Text className="text-body-sm font-medium text-ink-800">Currency</Text>
          <Text className="text-caption text-ink-500">
            Your whole catalog will be priced in this currency - it can&apos;t be changed per product later.
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip label="USD ($)" selected={currencyCode === "usd"} onPress={() => setCurrencyCode("usd")} />
            <Chip label="ETB (Br)" selected={currencyCode === "etb"} onPress={() => setCurrencyCode("etb")} />
          </View>
          {fieldErrors.currency_code ? (
            <Text className="text-body-sm text-danger">{fieldErrors.currency_code}</Text>
          ) : null}
        </View>

        <Input
          label="Business description"
          value={businessDescription}
          onChangeText={setBusinessDescription}
          error={fieldErrors.business_description}
          multiline
          numberOfLines={4}
        />
        <Input
          label="Estimated number of products"
          value={estimatedProductCount}
          onChangeText={setEstimatedProductCount}
          error={fieldErrors.estimated_product_count}
          keyboardType="number-pad"
        />

        <View className="gap-2">
          <Text className="text-body-sm font-medium text-ink-800">What will you sell?</Text>
          <View className="flex-row flex-wrap gap-2">
            {PRODUCT_CATEGORIES.map((category) => (
              <Chip key={category} label={category} selected={productCategories.includes(category)} onPress={() => toggleCategory(category)} />
            ))}
          </View>
          {fieldErrors.product_categories ? (
            <Text className="text-body-sm text-danger">{fieldErrors.product_categories}</Text>
          ) : null}
        </View>

        <Text className="text-h2 text-ink-950">Contact</Text>
        <Input label="First name" value={contactFirstName} onChangeText={setContactFirstName} error={fieldErrors.contact_first_name} />
        <Input label="Last name" value={contactLastName} onChangeText={setContactLastName} error={fieldErrors.contact_last_name} />
        <Input
          label="Business email"
          value={businessEmail}
          onChangeText={setBusinessEmail}
          error={fieldErrors.business_email}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input label="Phone number" value={phoneNumber} onChangeText={setPhoneNumber} error={fieldErrors.phone_number} keyboardType="phone-pad" />
        <Input
          label="Website (optional)"
          value={websiteUrl}
          onChangeText={setWebsiteUrl}
          error={fieldErrors.website_url}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text className="text-h2 text-ink-950">Business address</Text>
        <Input label="Address line 1" value={addressLine1} onChangeText={setAddressLine1} error={fieldErrors.address_line1} />
        <Input label="Address line 2 (optional)" value={addressLine2} onChangeText={setAddressLine2} />
        <Input label="City" value={addressCity} onChangeText={setAddressCity} error={fieldErrors.address_city} />
        <Input label="State" value={addressState} onChangeText={setAddressState} error={fieldErrors.address_state} />
        <Input label="Postal code" value={addressPostalCode} onChangeText={setAddressPostalCode} error={fieldErrors.address_postal_code} keyboardType="number-pad" />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedToTerms }}
          onPress={() => setAgreedToTerms((v) => !v)}
          className="flex-row items-start gap-2 py-2"
        >
          <Ionicons name={agreedToTerms ? "checkbox" : "square-outline"} size={22} color="#151210" />
          <Text className="flex-1 text-body-sm text-ink-700">
            I agree to Bawi&apos;s seller terms and confirm the information above is accurate.
          </Text>
        </Pressable>
        {fieldErrors.agreed_to_terms ? <Text className="text-body-sm text-danger">{fieldErrors.agreed_to_terms}</Text> : null}

        <Button onPress={onSubmit} loading={submitting}>
          Submit application
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
