import { Button, Input } from "@bawi/mobile-ui";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { MedusaAuthError } from "@/features/auth/hooks/use-auth";
import { resetPasswordSchema } from "@/features/auth/schemas/reset-password-schema";
import { resetPassword } from "@/features/auth/services/medusa-auth-client";

export default function ResetPasswordScreen() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });
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
      await resetPassword(parsed.data.token, parsed.data.password);
      setDone(true);
    } catch (error) {
      setFormError(
        error instanceof MedusaAuthError ? error.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper px-6">
        <Text className="text-h1 text-ink-950">Password updated</Text>
        <Text className="text-center text-body text-ink-500">
          Your password has been reset. Log in with your new password.
        </Text>
        <Button onPress={() => router.replace("/login")}>Log in</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6 gap-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4 gap-1">
          <Text className="text-h1 text-ink-950">Enter your reset code</Text>
          <Text className="text-body text-ink-500">
            Paste the reset code from your email and choose a new password.
          </Text>
        </View>
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}
        <Input
          label="Reset code"
          value={token}
          onChangeText={setToken}
          error={fieldErrors.token}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label="New password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          secureTextEntry
          textContentType="newPassword"
        />
        <Input
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          secureTextEntry
          textContentType="newPassword"
        />
        <Button onPress={onSubmit} loading={submitting}>
          Reset password
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
