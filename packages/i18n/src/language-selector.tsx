"use client"

import { useTransition } from "react"
import { LOCALES, LOCALE_NAMES } from "./locales"
import { useLocale, useTranslations } from "./locale-context"
import { setLocale } from "./set-locale-action"

/** Auto-submits on change so switching language needs one interaction, not two. */
export function LanguageSelector() {
  const locale = useLocale()
  const t = useTranslations()
  const [isPending, startTransition] = useTransition()

  return (
    <form
      onChange={(event) => {
        const form = event.currentTarget
        startTransition(() => {
          setLocale(new FormData(form))
        })
      }}
    >
      <label className="sr-only" htmlFor="locale-select">
        {t("common.language")}
      </label>
      <select
        id="locale-select"
        name="locale"
        defaultValue={locale}
        disabled={isPending}
        aria-label={t("common.language")}
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </form>
  )
}
