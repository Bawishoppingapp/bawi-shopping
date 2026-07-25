import { describe, expect, test } from "vitest"
import { translate } from "../translate"
import { LOCALES, DEFAULT_LOCALE } from "../locales"
import { MESSAGES_BY_LOCALE } from "../messages"

describe("translate", () => {
  test("returns the requested locale's string when present", () => {
    expect(translate("es", "register.submit")).toBe("Crear cuenta")
  })

  test("falls back to en-US when the key is missing from the requested locale", () => {
    // "missing.key" doesn't exist anywhere - falling through to en-US's
    // own lookup returns the key itself as a last resort, proving the
    // fallback chain terminates rather than throwing or returning undefined.
    // @ts-expect-error - deliberately an invalid key to exercise the fallback path
    expect(translate("es", "missing.key")).toBe("missing.key")
  })

  test("English rendering never depends on another locale's catalog", () => {
    expect(translate("en-US", "register.submit")).toBe("Create account")
  })

  test("every key in every non-English locale file also exists in en-US.json", () => {
    const englishKeys = new Set(Object.keys(MESSAGES_BY_LOCALE[DEFAULT_LOCALE]))
    for (const locale of LOCALES) {
      if (locale === DEFAULT_LOCALE) continue
      for (const key of Object.keys(MESSAGES_BY_LOCALE[locale])) {
        expect(englishKeys.has(key), `${locale}.json has key "${key}" missing from en-US.json`).toBe(
          true
        )
      }
    }
  })

  test("en-US.json has no missing values for any of its own keys", () => {
    for (const [key, value] of Object.entries(MESSAGES_BY_LOCALE[DEFAULT_LOCALE])) {
      expect(value, `en-US.json key "${key}" is empty`).toBeTruthy()
    }
  })
})
