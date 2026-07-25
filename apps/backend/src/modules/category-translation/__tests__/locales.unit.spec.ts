import { isTranslatableLocale, TRANSLATABLE_LOCALES } from "../locales"

describe("isTranslatableLocale", () => {
  test.each(TRANSLATABLE_LOCALES)("accepts %s", (locale) => {
    expect(isTranslatableLocale(locale)).toBe(true)
  })

  test("rejects en-US (English lives on the native category row, not a translation)", () => {
    expect(isTranslatableLocale("en-US")).toBe(false)
  })

  test("rejects an unknown locale code", () => {
    expect(isTranslatableLocale("fr")).toBe(false)
  })
})
