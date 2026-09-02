import { DEFAULT_LOCALE, type Locale } from "./locales"
import { MESSAGES_BY_LOCALE, type MessageKey } from "./messages"
export type { MessageKey } from "./messages"

/**
 * Resolves `key` in `locale`'s message catalog, falling back to en-US when
 * the key is missing from that locale - never a blank string or a raw key,
 * per docs/PRD.md §9.24. Pure function (no I/O) so it's directly
 * unit-testable without a request/cookie context.
 */
export type TranslationValues = Record<string, string | number>

export function translate(locale: Locale, key: MessageKey, values?: TranslationValues): string {
  const localized = MESSAGES_BY_LOCALE[locale]?.[key]
  const message = localized || MESSAGES_BY_LOCALE[DEFAULT_LOCALE][key] || key
  if (!values) return message
  return message.replace(/\{([^}]+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
  )
}

export function createTranslator(locale: Locale) {
  return (key: MessageKey, values?: TranslationValues) => translate(locale, key, values)
}
