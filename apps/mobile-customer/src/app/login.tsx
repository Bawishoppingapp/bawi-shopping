import { Button, Input } from "@bawi/mobile-ui";
import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { MedusaAuthError, useAuth } from "@/features/auth/hooks/use-auth";
import { loginSchema } from "@/features/auth/schemas/login-schema";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
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
      router.back();
    } catch (error) {
      setFormError(
        error instanceof MedusaAuthError ? error.message : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-paper"
    >
      <ScrollView contentContainerClassName="flex-1 justify-center px-6 gap-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4 gap-1">
          <Text className="text-h1 text-ink-950">Welcome back</Text>
          <Text className="text-body text-ink-500">Log in to your Bawi account.</Text>
        </View>
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}
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
        <Link href="/forgot-password" asChild>
          <Text className="text-center text-body-sm text-ink-500">Forgot password?</Text>
        </Link>
        <Link href="/register" replace asChild>
          <Text className="text-center text-body-sm text-ink-500">
            Don&apos;t have an account? <Text className="font-medium text-ink-950">Sign up</Text>
          </Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
