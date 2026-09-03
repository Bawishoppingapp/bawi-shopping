import { Button, Input } from "@bawi/mobile-ui";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { resetPasswordSchema } from "@/features/auth/schemas/reset-password-schema";
import { resetPassword } from "@/features/auth/services/medusa-auth-client";
import { useTranslations } from "@/features/i18n/hooks/use-locale";
import { localizeValidationMessage } from "@/features/i18n/utils/localize-validation";

export default function ResetPasswordScreen() {
  const t = useTranslations();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const linkedToken = Array.isArray(params.token) ? params.token[0] : params.token;
    if (linkedToken) setToken(linkedToken);
  }, [params.token]);

  async function onSubmit() {
    setFormError(null);
    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });
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
      await resetPassword(parsed.data.token, parsed.data.password);
      setDone(true);
    } catch {
      setFormError(
        t("auth.genericError")
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-paper px-6">
        <Text className="text-h1 text-ink-950">{t("auth.passwordUpdated")}</Text>
        <Text className="text-center text-body text-ink-500">
          {t("auth.passwordUpdatedBody")}
        </Text>
        <Button onPress={() => router.replace("/login")}>{t("login.submit")}</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-paper">
      <ScrollView contentContainerClassName="flex-1 justify-center px-6 gap-4" keyboardShouldPersistTaps="handled">
        <View className="mb-4 gap-1">
          <Text className="text-h1 text-ink-950">{t("auth.resetCodeTitle")}</Text>
          <Text className="text-body text-ink-500">
            {t("auth.resetCodeBody")}
          </Text>
        </View>
        {formError ? (
          <View className="rounded-md bg-danger/10 p-3">
            <Text className="text-body-sm text-danger">{formError}</Text>
          </View>
        ) : null}
        <Input
          label={t("auth.resetCode")}
          value={token}
          onChangeText={setToken}
          error={fieldErrors.token}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Input
          label={t("auth.newPassword")}
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          secureTextEntry
          showPasswordLabel={t("auth.showPassword")}
          hidePasswordLabel={t("auth.hidePassword")}
          textContentType="newPassword"
        />
        <Input
          label={t("auth.confirmNewPassword")}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          secureTextEntry
          showPasswordLabel={t("auth.showPassword")}
          hidePasswordLabel={t("auth.hidePassword")}
          textContentType="newPassword"
        />
        <Button onPress={onSubmit} loading={submitting}>
          {t("auth.resetPassword")}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
