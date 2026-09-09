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

  test("unresolved business-decision entries remain flagged as placeholders", () => {
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
      "legal",
    ]
    for (const entry of DEFAULT_BUSINESS_CONFIG_ENTRIES) {
      if (businessDecisionCategories.includes(entry.category)) {
        const finalized =
          (entry.category === "commission" && entry.key === "platform_default_rate_basis_points") ||
          (entry.category === "returns" && entry.key === "return_window_days") ||
          (entry.category === "support" && entry.key === "support_email") ||
          (entry.category === "shipping" && ["standard_shipping_fee_cents_etb", "neighboring_shipping_fee_cents_etb"].includes(entry.key)) ||
          (entry.category === "cancellation" && entry.key === "cancellation_cutoff") ||
          (entry.category === "service_area" && entry.key === "initial_service_area") ||
          (entry.category === "tax" && entry.key === "mock_rate_basis_points")
        expect(entry.is_placeholder).toBe(!finalized)
      }
    }
  })
})
