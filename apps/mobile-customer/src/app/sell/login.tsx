import { Button, Input } from "@bawi/mobile-ui";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { clearPendingApplicationId } from "@/features/seller-application/services/pending-application-storage";
import { SellerAuthError, useSellerAuth } from "@/features/seller-auth/hooks/use-seller-auth";
import { sellerLoginSchema } from "@/features/seller-auth/schemas/seller-login-schema";

export default function SellLoginScreen() {
  const { login } = useSellerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = sellerLoginSchema.safeParse({ email, password });
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
      await login(parsed.data.email, parsed.data.password);
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
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Seller log in",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <ScrollView contentContainerClassName="flex-1 justify-center px-6 gap-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4 gap-1">
          <Text className="text-h1 text-ink-950">Seller log in</Text>
          <Text className="text-body text-ink-500">Log in to manage your storefront.</Text>
        </View>
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}
        <Input
          label="Business email"
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
        />
        <Button onPress={onSubmit} loading={submitting}>
          Log in
        </Button>
        {submitting ? (
          <Text className="text-center text-body-sm text-ink-500">
            Connecting to the seller service. This may take a moment if the service is starting.
          </Text>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.push("/sell/pitch")} className="items-center py-2">
          <Text className="text-body-sm text-ink-500">New seller? <Text className="font-medium text-ink-950">Start an application</Text></Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push("/sell/activate")} className="items-center py-2">
          <Text className="text-body-sm text-ink-500">Approved but not activated? <Text className="font-medium text-ink-950">Activate storefront</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
