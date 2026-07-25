// Client-safe exports only - see ./server.ts for getLocale (which imports
// "server-only" and next/headers, and must never be pulled into a Client
// Component's bundle even transitively through this barrel).
export { LOCALES, LOCALE_NAMES, DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isLocale } from "./locales"
export type { Locale } from "./locales"
export { translate, createTranslator } from "./translate"
export type { MessageKey, Messages } from "./messages"
export { LocaleProvider, useLocale, useTranslations } from "./locale-context"
export { setLocale } from "./set-locale-action"
export { LanguageSelector } from "./language-selector"
