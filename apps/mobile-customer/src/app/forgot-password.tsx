import { Button, Input } from "@bawi/mobile-ui";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { forgotPasswordSchema } from "@/features/auth/schemas/forgot-password-schema";
import { requestPasswordReset } from "@/features/auth/services/medusa-auth-client";
import { useTranslations } from "@/features/i18n/hooks/use-locale";
import { localizeValidationMessage } from "@/features/i18n/utils/localize-validation";

export default function ForgotPasswordScreen() {
  const t = useTranslations();
  const [email, setEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
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
      await requestPasswordReset(parsed.data.email);
      setSent(true);
    } catch {
      setFormError(t("auth.genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper px-6">
        <Text className="text-h1 text-ink-950">{t("auth.checkEmail")}</Text>
        <Text className="text-center text-body text-ink-500">
          {t("auth.resetSent", { email })}
        </Text>
        <Button onPress={() => router.replace("/reset-password")}>{t("auth.enterResetCode")}</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6 gap-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4 gap-1">
          <Text className="text-h1 text-ink-950">{t("auth.resetTitle")}</Text>
          <Text className="text-body text-ink-500">{t("auth.resetEmailBody")}</Text>
        </View>
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}
        <Input
          label={t("login.email")}
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Button onPress={onSubmit} loading={submitting}>
          {t("auth.sendResetCode")}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
