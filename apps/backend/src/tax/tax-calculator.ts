export interface TaxCalculationResult {
  tax_amount: number
  tax_rate_basis_points: number
}

/**
 * Pure calculation, no I/O - same shape/reasoning as
 * cart/shipping-estimate.ts's calculateShippingEstimate(). Applies one flat
 * rate regardless of shipping address/jurisdiction - a real provider
 * (rate-by-jurisdiction, or a third-party tax API) is a documented future
 * replacement once real_tax_calculation_enabled is turned on (see
 * docs/DECISIONS.md); this is the mock adapter for business-config's
 * `tax` category, built now because checkout is its first real caller
 * (the category/key already existed with no consumer - see
 * docs/DECISIONS.md "mock adapters only built as each consuming phase
 * lands").
 */
export function calculateMockTax(
  taxableAmountCents: number,
  rateBasisPoints: number
): TaxCalculationResult {
  const taxAmount = Math.round((taxableAmountCents * rateBasisPoints) / 10000)
  return {
    tax_amount: taxAmount,
    tax_rate_basis_points: rateBasisPoints,
  }
}
