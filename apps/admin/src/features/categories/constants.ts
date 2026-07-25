export interface CategoryFormState {
  status: "idle" | "error" | "success"
  fieldErrors: Partial<Record<"name", string>>
  formError?: string
}

export const initialCategoryFormState: CategoryFormState = {
  status: "idle",
  fieldErrors: {},
}

// Mirrors packages/i18n's LOCALES minus en-US - English is the category's
// own native `name`, never a translation row (see docs/DATABASE.md).
export const TRANSLATABLE_LOCALES = [
  { code: "am", label: "አማርኛ (Amharic)" },
  { code: "ti", label: "ትግርኛ (Tigrinya)" },
  { code: "om", label: "Afaan Oromoo (Oromo)" },
  { code: "zh-CN", label: "简体中文 (Chinese)" },
  { code: "es", label: "Español (Spanish)" },
] as const
