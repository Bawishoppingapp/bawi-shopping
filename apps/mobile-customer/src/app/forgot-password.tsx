import { Button, Input } from "@bawi/mobile-ui";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { forgotPasswordSchema } from "@/features/auth/schemas/forgot-password-schema";
import { requestPasswordReset } from "@/features/auth/services/medusa-auth-client";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    const parsed = forgotPasswordSchema.safeParse({ email });
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
      await requestPasswordReset(parsed.data.email);
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper px-6">
        <Text className="text-h1 text-ink-950">Check your email</Text>
        <Text className="text-center text-body text-ink-500">
          If an account exists for {email}, we&apos;ve sent a reset code. Enter it on the next screen along
          with your new password.
        </Text>
        <Button onPress={() => router.replace("/reset-password")}>Enter reset code</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6 gap-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4 gap-1">
          <Text className="text-h1 text-ink-950">Reset your password</Text>
          <Text className="text-body text-ink-500">We&apos;ll email you a code to reset your password.</Text>
        </View>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Button onPress={onSubmit} loading={submitting}>
          Send reset code
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
