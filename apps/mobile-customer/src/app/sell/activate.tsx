import { Button, Input } from "@bawi/mobile-ui";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { clearPendingApplicationId } from "@/features/seller-application/services/pending-application-storage";
import { activationSchema } from "@/features/seller-auth/schemas/activation-schema";
import { SellerAuthError, completeSellerActivation } from "@/features/seller-auth/services/seller-medusa-auth-client";

export default function SellActivateScreen() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = activationSchema.safeParse({ token, password, confirmPassword });
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
      await completeSellerActivation(parsed.data.token, parsed.data.password);
      await clearPendingApplicationId();
      router.replace({ pathname: "/sell/login", params: { activated: "1" } });
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
            Paste the activation code from your approval email and choose a password.
          </Text>
        </View>
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}
        <Input
          label="Activation code"
          value={token}
          onChangeText={setToken}
          error={fieldErrors.token}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          secureTextEntry
          textContentType="newPassword"
        />
        <Input
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          secureTextEntry
          textContentType="newPassword"
        />
        <Button onPress={onSubmit} loading={submitting}>
          Activate
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
