export interface CommissionResult {
  commission_rate_basis_points: number
  commission_amount: number
}

/**
 * Resolution order per docs/PAYMENTS.md §4: seller-specific override ->
 * category default -> platform default. `seller.commission_rate_override`
 * doesn't exist as a column yet (still "to come" per docs/DATABASE.md), so
 * `sellerOverrideBasisPoints` is always undefined today - the parameter
 * exists now so a later payouts-slice migration only has to populate the
 * value, not touch this resolution order. Round-half-up to the nearest
 * cent, per docs/PAYMENTS.md §4 - the one place this multiplication
 * happens, server-side.
 */
export function resolveCommission(
  itemSubtotalCents: number,
  platformDefaultRateBasisPoints: number,
  sellerOverrideBasisPoints?: number | null
): CommissionResult {
  const rate = sellerOverrideBasisPoints ?? platformDefaultRateBasisPoints
  const commissionAmount = Math.round((itemSubtotalCents * rate) / 10000)
  return {
    commission_rate_basis_points: rate,
    commission_amount: commissionAmount,
  }
}
