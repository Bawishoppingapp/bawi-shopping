import { DEFAULT_LOCALE, type Locale } from "./locales"
import { MESSAGES_BY_LOCALE, type MessageKey } from "./messages"

/**
 * Resolves `key` in `locale`'s message catalog, falling back to en-US when
 * the key is missing from that locale - never a blank string or a raw key,
 * per docs/PRD.md §9.24. Pure function (no I/O) so it's directly
 * unit-testable without a request/cookie context.
 */
export function translate(locale: Locale, key: MessageKey): string {
  const localized = MESSAGES_BY_LOCALE[locale]?.[key]
  if (localized) {
    return localized
  }
  return MESSAGES_BY_LOCALE[DEFAULT_LOCALE][key] ?? key
}

export function createTranslator(locale: Locale) {
  return (key: MessageKey) => translate(locale, key)
}
