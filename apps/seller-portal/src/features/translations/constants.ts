import type { TranslationFormState } from "./actions/translations-actions"

export const initialTranslationFormState: TranslationFormState = { status: "idle" }

export const LOCALE_LABELS: Record<string, string> = {
  am: "አማርኛ (Amharic)",
  ti: "ትግርኛ (Tigrinya)",
  om: "Afaan Oromoo",
  "zh-CN": "简体中文 (Simplified Chinese)",
  es: "Español (Spanish)",
}

export const TRANSLATABLE_LOCALES = ["am", "ti", "om", "zh-CN", "es"] as const
