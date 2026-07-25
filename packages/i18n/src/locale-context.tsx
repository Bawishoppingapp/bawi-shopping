"use client"

import { createContext, useContext, useMemo } from "react"
import type { Locale } from "./locales"
import { translate } from "./translate"
import type { MessageKey } from "./messages"

const LocaleContext = createContext<Locale | null>(null)

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  const locale = useContext(LocaleContext)
  if (!locale) {
    throw new Error("useLocale must be used within a LocaleProvider")
  }
  return locale
}

export function useTranslations() {
  const locale = useLocale()
  return useMemo(() => (key: MessageKey) => translate(locale, key), [locale])
}
