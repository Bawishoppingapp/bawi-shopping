export interface RefundCalculationResult {
  refund_amount: number
  commission_reversal_amount: number
  net_reversal_amount: number
  is_partial: boolean
}

/**
 * Refund amount always comes from stored order/item data - never a
 * client-supplied figure (docs/PAYMENTS.md). Defaults to a full refund of
 * the item's line_total; `requestedAmount` lets an admin/seller issue a
 * partial refund instead, always capped at the item's line_total (never
 * more than what was actually charged for it) and never negative.
 *
 * The commission reversal is proportional to the refunded share of the
 * item, per docs/PAYMENTS.md §6 ("if 50% of a VendorOrderItem's amount is
 * refunded, 50% of its original commission is reversed"). Round-half-up,
 * the same rounding rule used everywhere else in this codebase's money
 * math.
 */
export function calculateRefund(
  itemLineTotal: number,
  itemCommissionShare: number,
  requestedAmount?: number
): RefundCalculationResult {
  const refundAmount = Math.max(
    0,
    Math.min(requestedAmount ?? itemLineTotal, itemLineTotal)
  )
  const refundRatio = itemLineTotal > 0 ? refundAmount / itemLineTotal : 0
  const commissionReversal = Math.round(itemCommissionShare * refundRatio)
  const netReversal = refundAmount - commissionReversal

  return {
    refund_amount: refundAmount,
    commission_reversal_amount: commissionReversal,
    net_reversal_amount: netReversal,
    is_partial: refundAmount < itemLineTotal,
  }
}
