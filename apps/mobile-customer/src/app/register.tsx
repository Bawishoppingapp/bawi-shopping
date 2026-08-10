import { Button, Input } from "@bawi/mobile-ui";
import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { MedusaAuthError, useAuth } from "@/features/auth/hooks/use-auth";
import { registerSchema } from "@/features/auth/schemas/register-schema";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = registerSchema.safeParse({ firstName, lastName, email, password });
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
      await register(parsed.data);
      router.back();
    } catch (error) {
      if (error instanceof MedusaAuthError) {
        setFormError(
          /already exists/i.test(error.message)
            ? "An account with this email already exists."
            : error.message
        );
      } else {
        setFormError("Something went wrong. Please try again.");
      }
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
          <Text className="text-h1 text-ink-950">Create your account</Text>
          <Text className="text-body text-ink-500">Shop independent fashion brands on Bawi.</Text>
        </View>
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              error={fieldErrors.firstName}
              autoComplete="given-name"
              textContentType="givenName"
            />
          </View>
          <View className="flex-1">
            <Input
              label="Last name"
              value={lastName}
              onChangeText={setLastName}
              error={fieldErrors.lastName}
              autoComplete="family-name"
              textContentType="familyName"
            />
          </View>
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
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          helperText={fieldErrors.password ? undefined : "At least 8 characters, with a lowercase letter, uppercase letter, and number."}
          secureTextEntry
          autoComplete="password-new"
          textContentType="newPassword"
        />
        <Button onPress={onSubmit} loading={submitting}>
          Create account
        </Button>
        <Link href="/login" replace asChild>
          <Text className="text-center text-body-sm text-ink-500">
            Already have an account? <Text className="font-medium text-ink-950">Log in</Text>
          </Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
