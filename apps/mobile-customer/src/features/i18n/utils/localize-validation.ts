import type { MessageKey } from "@bawi/i18n/translate";

const EXACT_KEYS: Record<string, MessageKey> = {
  "Enter a valid email address": "validation.invalidEmail",
  "Passwords do not match": "auth.passwordMismatch",
  "Enter a valid Ethiopian mobile number (e.g. 0911234567)": "validation.invalidPhone",
};

const PASSWORD_RULE_KEYS: [string, MessageKey][] = [
  ["at least 8 characters", "auth.ruleLength"],
  ["one lowercase letter", "auth.ruleLowercase"],
  ["one uppercase letter", "auth.ruleUppercase"],
  ["one number", "auth.ruleNumber"],
];

export function localizeValidationMessage(
  message: string,
  t: (key: MessageKey) => string,
): string {
  const exact = EXACT_KEYS[message];
  if (exact) return t(exact);
  const lower = message.toLowerCase();
  const passwordRule = PASSWORD_RULE_KEYS.find(([fragment]) => lower.includes(fragment));
  if (passwordRule) return t(passwordRule[1]);
  if (/required|confirm your password|select a country/i.test(message)) return t("validation.required");
  return t("common.error");
}
