import {
  slugify,
  generateUniqueSlug,
  generateActivationToken,
} from "../utils"

describe("slugify", () => {
  test("lowercases and hyphenates a store name", () => {
    expect(slugify("Acme Denim Co.")).toBe("acme-denim-co")
  })

  test("collapses repeated separators and trims leading/trailing hyphens", () => {
    expect(slugify("  --Acme!!  Denim--  ")).toBe("acme-denim")
  })

  test("falls back to an empty string for input with no alphanumerics", () => {
    expect(slugify("!!!")).toBe("")
  })
})

describe("generateUniqueSlug (approval logic)", () => {
  test("returns the base slug when it isn't taken", async () => {
    const slug = await generateUniqueSlug("Acme Denim", async () => false)
    expect(slug).toBe("acme-denim")
  })

  test("appends a random suffix until an untaken slug is found", async () => {
    let calls = 0
    const slug = await generateUniqueSlug("Acme Denim", async () => {
      calls += 1
      return calls < 3 // first two calls report "taken", third is free
    })
    expect(slug).toMatch(/^acme-denim(-[0-9a-f]{6})?$/)
    expect(calls).toBe(3)
  })

  test("falls back to 'seller' as the root when the name has no alphanumerics", async () => {
    const slug = await generateUniqueSlug("!!!", async () => false)
    expect(slug).toBe("seller")
  })
})

describe("generateActivationToken", () => {
  test("generates a 64-character hex string", () => {
    const token = generateActivationToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  test("generates a different token on each call", () => {
    expect(generateActivationToken()).not.toBe(generateActivationToken())
  })
})
