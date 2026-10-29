import {
  slugify,
  generateUniqueSlug,
  generateActivationToken,
  buildSellerActivationLink,
  formatActivationToken,
  normalizeActivationToken,
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

describe("buildSellerActivationLink", () => {
  const originalUrl = process.env.SELLER_PORTAL_URL
  afterEach(() => {
    if (originalUrl === undefined) delete process.env.SELLER_PORTAL_URL
    else process.env.SELLER_PORTAL_URL = originalUrl
  })

  test("creates an absolute seller portal link with the exact token", () => {
    process.env.SELLER_PORTAL_URL = "https://bawi-shopping-seller-portal.vercel.app/"
    expect(buildSellerActivationLink("abc123")).toBe(
      "https://bawi-shopping-seller-portal.vercel.app/activate?token=abc123"
    )
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
  test("generates a 12-character human-friendly code", () => {
    const token = generateActivationToken()
    expect(token).toMatch(/^[A-HJ-NP-Z2-9]{12}$/)
    expect(formatActivationToken(token)).toMatch(/^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){2}$/)
    expect(normalizeActivationToken(formatActivationToken(token).toLowerCase())).toBe(token)
  })

  test("generates a different token on each call", () => {
    expect(generateActivationToken()).not.toBe(generateActivationToken())
  })

  test("keeps existing long activation links valid", () => {
    const oldToken = "a1b2".repeat(16)
    expect(normalizeActivationToken(oldToken)).toBe(oldToken)
  })
})
