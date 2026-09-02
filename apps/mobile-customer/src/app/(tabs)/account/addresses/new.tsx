import { Button, Input, ThemedIcon } from "@bawi/mobile-ui";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { getSessionToken } from "@/features/auth/services/token-storage";
import {
  createAddress,
} from "@/features/addresses/services/addresses-client";
import { CountryPicker } from "@/features/addresses/components/country-picker";
import { findCountry } from "@/features/addresses/data/countries";
import { addressSchema } from "@/features/addresses/schemas/address-schema";
import { normalizeEthiopianPhone } from "@/features/addresses/utils/phone-format";
import { useTranslations } from "@/features/i18n/hooks/use-locale";
import { localizeValidationMessage } from "@/features/i18n/utils/localize-validation";

export default function NewAddressScreen() {
  const t = useTranslations();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState<string | null>("et");
  const [phone, setPhone] = useState("");
  const [subCity, setSubCity] = useState("");
  const [woreda, setWoreda] = useState("");
  const [landmark, setLandmark] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [isDefaultShipping, setIsDefaultShipping] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCountry = findCountry(countryCode);
  const isEthiopia = countryCode === "et";

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
      country_code: countryCode ?? "",
      phone: isEthiopia && phone ? normalizeEthiopianPhone(phone) : phone,
      sub_city: subCity,
      woreda,
      landmark,
      delivery_notes: deliveryNotes,
      is_default_shipping: isDefaultShipping,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (!errors[field]) errors[field] = localizeValidationMessage(issue.message, t);
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const token = await getSessionToken();
      const {
        landmark: landmarkValue,
        delivery_notes: deliveryNotesValue,
        sub_city: subCityValue,
        woreda: woredaValue,
        ...addressFields
      } = parsed.data;
      const metadata =
        landmarkValue || deliveryNotesValue || subCityValue || woredaValue
          ? {
              landmark: landmarkValue || undefined,
              delivery_notes: deliveryNotesValue || undefined,
              sub_city: subCityValue || undefined,
              woreda: woredaValue || undefined,
            }
          : undefined;
      await createAddress(token, { ...addressFields, metadata });
      router.back();
    } catch {
      setFormError(
        t("common.error")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: t("address.new") }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}

        <CountryPicker
          selectedCode={countryCode}
          onSelect={(country) => setCountryCode(country.code)}
          error={fieldErrors.country_code}
        />

        <Input label={t("checkout.firstName")} value={firstName} onChangeText={setFirstName} error={fieldErrors.first_name} />
        <Input label={t("checkout.lastName")} value={lastName} onChangeText={setLastName} error={fieldErrors.last_name} />
        <Input label={t("checkout.addressLine1")} value={addressLine1} onChangeText={setAddressLine1} error={fieldErrors.address_1} />
        <Input label={t("address.line2Optional")} value={addressLine2} onChangeText={setAddressLine2} />
        <Input label={t("checkout.city")} value={city} onChangeText={setCity} error={fieldErrors.city} />
        <Input
          label={t("address.regionOptional")}
          value={province}
          onChangeText={setProvince}
          error={fieldErrors.province}
        />
        {isEthiopia ? (
          <>
            <Input
              label={t("address.subCityOptional")}
              value={subCity}
              onChangeText={setSubCity}
            />
            <Input label={t("address.woredaOptional")} value={woreda} onChangeText={setWoreda} />
          </>
        ) : null}
        <Input
          label={selectedCountry?.postalCodeRequired === false ? t("address.postalOptional") : t("checkout.postalCode")}
          value={postalCode}
          onChangeText={setPostalCode}
          error={fieldErrors.postal_code}
          autoCapitalize="characters"
        />
        <Input
          label={t("address.landmarkOptional")}
          value={landmark}
          onChangeText={setLandmark}
          helperText={t("address.landmarkHint")}
        />
        <Input
          label={t("address.deliveryNotesOptional")}
          value={deliveryNotes}
          onChangeText={setDeliveryNotes}
          multiline
          numberOfLines={2}
          helperText={t("address.deliveryNotesHint")}
        />
        <Input
          label={t("address.phoneOptional")}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder={selectedCountry ? `${selectedCountry.phoneCode} …` : undefined}
        />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isDefaultShipping }}
          onPress={() => setIsDefaultShipping((v) => !v)}
          className="flex-row items-center gap-2 py-2"
        >
          <ThemedIcon name={isDefaultShipping ? "checkbox" : "square-outline"} size={22} />
          <Text className="text-body-sm text-ink-700">{t("address.setDefault")}</Text>
        </Pressable>

        <Button onPress={onSubmit} loading={submitting}>
          {t("address.save")}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
