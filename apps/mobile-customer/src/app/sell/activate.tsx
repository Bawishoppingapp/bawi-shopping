import { Button, Input } from "@bawi/mobile-ui";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { clearPendingApplicationId } from "@/features/seller-application/services/pending-application-storage";
import { activationSchema } from "@/features/seller-auth/schemas/activation-schema";
import { SellerAuthError, useSellerAuth } from "@/features/seller-auth/hooks/use-seller-auth";

export default function SellActivateScreen() {
  const { activate } = useSellerAuth();
  const [code, setCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = activationSchema.safeParse({ code });
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
      await activate(parsed.data.code);
      await clearPendingApplicationId();
      router.replace("/sell/dashboard");
    } catch (error) {
      setFormError(
        error instanceof SellerAuthError ? error.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: true, title: "Activate your storefront" }} />
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16, justifyContent: "center", flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="gap-1">
          <Text className="text-h1 text-ink-950">Activate your storefront</Text>
          <Text className="text-body text-ink-500">
            Enter the code from your newest approval email to open your storefront.
          </Text>
        </View>
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}
        <Input
          label="Activation code"
          value={code}
          onChangeText={setCode}
          error={fieldErrors.code}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Button onPress={onSubmit} loading={submitting}>
          Open storefront
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
