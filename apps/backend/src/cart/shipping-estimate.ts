export interface ShippingEstimate {
  shipping_estimate: number
  qualifies_for_free_shipping: boolean
  amount_remaining_for_free_shipping: number
}

/**
 * Pure calculation, no I/O - both inputs come from centralized business
 * configuration (never hardcoded), so this is a mock/staging-era estimate
 * only, not a real shipping quote. All amounts are integer cents.
 */
export function calculateShippingEstimate(
  subtotalCents: number,
  standardShippingFeeCents: number,
  freeShippingThresholdCents: number
): ShippingEstimate {
  const qualifies = subtotalCents >= freeShippingThresholdCents

  return {
    shipping_estimate: qualifies ? 0 : standardShippingFeeCents,
    qualifies_for_free_shipping: qualifies,
    amount_remaining_for_free_shipping: qualifies ? 0 : freeShippingThresholdCents - subtotalCents,
  }
}
