// Mirrors packages/i18n's LOCALES (see packages/i18n/src/locales.ts) minus
// "en-US" - English is never stored here, it lives on the native Medusa
// product-category row's own `name` field (same "English base row implicit"
// convention as the deferred product_translation table in docs/DATABASE.md).
// Duplicated rather than imported because packages/i18n depends on
// next/react and this is a Node-only Medusa backend module (see CLAUDE.md
// rule #10 - no unnecessary libraries).
export const TRANSLATABLE_LOCALES = ["am", "ti", "om", "zh-CN", "es"] as const

export type TranslatableLocale = (typeof TRANSLATABLE_LOCALES)[number]

export function isTranslatableLocale(value: string): value is TranslatableLocale {
  return (TRANSLATABLE_LOCALES as readonly string[]).includes(value)
}
