import "server-only"
import { cookies } from "next/headers"
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE_NAME, type Locale } from "./locales"

/** Server-side locale resolution: cookie first, English default otherwise. */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  const value = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  if (value && isLocale(value)) {
    return value
  }
  return DEFAULT_LOCALE
}
