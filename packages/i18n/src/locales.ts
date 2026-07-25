export const LOCALES = ["en-US", "am", "ti", "om", "zh-CN", "es"] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en-US"

export const LOCALE_NAMES: Record<Locale, string> = {
  "en-US": "English",
  am: "አማርኛ",
  ti: "ትግርኛ",
  om: "Afaan Oromoo",
  "zh-CN": "简体中文",
  es: "Español",
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

export const LOCALE_COOKIE_NAME = "bawi_locale"
