import { DEFAULT_BUSINESS_CONFIG_ENTRIES, FEATURE_FLAG_KEYS } from "../defaults"

describe("DEFAULT_BUSINESS_CONFIG_ENTRIES", () => {
  test("every (category, key) pair is unique", () => {
    const seen = new Set<string>()
    for (const entry of DEFAULT_BUSINESS_CONFIG_ENTRIES) {
      const id = `${entry.category}:${entry.key}`
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
  })

  test("every feature flag key has a corresponding default entry, defaulting to false and not a placeholder", () => {
    for (const key of FEATURE_FLAG_KEYS) {
      const entry = DEFAULT_BUSINESS_CONFIG_ENTRIES.find(
        (e) => e.category === "feature_flag" && e.key === key
      )
      expect(entry).toBeDefined()
      expect(entry?.value).toBe(false)
      expect(entry?.value_type).toBe("boolean")
      // Feature flags are an intentional safety default, not a pending
      // business decision - is_placeholder must stay false so the
      // production-readiness check never flags a flag as something to
      // "replace" (flipping it is a deliberate launch decision instead).
      expect(entry?.is_placeholder).toBe(false)
    }
  })

  test("no default entry outside feature_flag is accidentally marked is_sensitive", () => {
    for (const entry of DEFAULT_BUSINESS_CONFIG_ENTRIES) {
      if (entry.category !== "feature_flag") {
        expect(entry.is_sensitive ?? false).toBe(false)
      }
    }
  })

  test("live_payments_enabled and every real_* flag default to false", () => {
    const liveFlags = FEATURE_FLAG_KEYS.filter(
      (key) => key === "live_payments_enabled" || key.startsWith("real_")
    )
    expect(liveFlags.length).toBeGreaterThan(0)
    for (const key of liveFlags) {
      const entry = DEFAULT_BUSINESS_CONFIG_ENTRIES.find(
        (e) => e.category === "feature_flag" && e.key === key
      )
      expect(entry?.value).toBe(false)
    }
  })

  test("known business-decision categories (commission, transfer_timing, returns, shipping, preparation, service_area, tax, courier, email, sms, support) are all flagged as placeholders", () => {
    const businessDecisionCategories = [
      "commission",
      "transfer_timing",
      "returns",
      "shipping",
      "preparation",
      "cancellation",
      "service_area",
      "tax",
      "courier",
      "email",
      "sms",
      "support",
    ]
    for (const entry of DEFAULT_BUSINESS_CONFIG_ENTRIES) {
      if (businessDecisionCategories.includes(entry.category)) {
        expect(entry.is_placeholder).toBe(true)
      }
    }
  })
})
