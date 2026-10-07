import { Button, Input } from "@bawi/mobile-ui";
import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { MedusaAuthError, useAuth } from "@/features/auth/hooks/use-auth";
import { PasswordRequirements } from "@/features/auth/components/password-requirements";
import { registerSchema } from "@/features/auth/schemas/register-schema";
import { useTranslations } from "@/features/i18n/hooks/use-locale";
import { localizeValidationMessage } from "@/features/i18n/utils/localize-validation";

export default function RegisterScreen() {
  const { register } = useAuth();
  const t = useTranslations();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = registerSchema.safeParse({ firstName, lastName, email, password, confirmPassword });
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
      await register(parsed.data);
      router.back();
    } catch (error) {
      if (error instanceof MedusaAuthError) {
        setFormError(
          /already exists/i.test(error.message)
            ? t("auth.accountExists")
            : t("common.error")
        );
      } else {
        // Not a MedusaAuthError means the fetch itself threw (no
        // connection, server unreachable) rather than the server
        // responding with an error - a distinct failure mode from a
        // rejected registration.
        setFormError(t("auth.networkError"));
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
          <Text className="text-h1 text-ink-950">{t("register.title")}</Text>
          <Text className="text-body text-ink-500">{t("auth.registerSubtitle")}</Text>
        </View>
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Input
              label={t("register.firstName")}
              value={firstName}
              onChangeText={setFirstName}
              error={fieldErrors.firstName}
              autoComplete="given-name"
              textContentType="givenName"
            />
          </View>
          <View className="flex-1">
            <Input
              label={t("register.lastName")}
              value={lastName}
              onChangeText={setLastName}
              error={fieldErrors.lastName}
              autoComplete="family-name"
              textContentType="familyName"
            />
          </View>
        </View>
        <Input
          label={t("register.email")}
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Input
          label={t("register.password")}
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          onFocus={() => setPasswordFocused(true)}
          secureTextEntry
          showPasswordLabel={t("auth.showPassword")}
          hidePasswordLabel={t("auth.hidePassword")}
          autoComplete="password-new"
          textContentType="newPassword"
        />
        {passwordFocused || password.length > 0 ? <PasswordRequirements password={password} /> : null}
        <Input
          label={t("auth.confirmPassword")}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          secureTextEntry
          showPasswordLabel={t("auth.showPassword")}
          hidePasswordLabel={t("auth.hidePassword")}
          autoComplete="password-new"
          textContentType="newPassword"
          onSubmitEditing={onSubmit}
          returnKeyType="done"
        />
        <Button onPress={onSubmit} loading={submitting}>
          {t("register.submit")}
        </Button>
        <Link href="/login" replace asChild>
          <Text className="text-center text-body-sm text-ink-500">
            {t("register.haveAccount")} <Text className="font-medium text-ink-950">{t("login.submit")}</Text>
          </Text>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
