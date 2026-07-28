export type LedgerBucket = "pending" | "available" | "paid" | "disputed"

export interface LedgerEntryLike {
  net_amount: number
  available_at: Date | string | null
  paid_at: Date | string | null
  disputed_at: Date | string | null
}

/**
 * Pure derivation of a ledger entry's current bucket - never a stored,
 * mutable status column, since there's no background scheduler in this
 * project to keep one in sync as time passes (see docs/DECISIONS.md).
 * Order of checks matters: a paid entry stays "paid" even if later
 * disputed (the dispute is tracked, but money already moved); disputed
 * beats pending/available since it's the more urgent state to surface.
 */
export function deriveLedgerBucket(entry: LedgerEntryLike, now: Date = new Date()): LedgerBucket {
  if (entry.paid_at) {
    return "paid"
  }
  if (entry.disputed_at) {
    return "disputed"
  }
  if (entry.available_at && new Date(entry.available_at).getTime() <= now.getTime()) {
    return "available"
  }
  return "pending"
}

export interface SellerBalanceSummary {
  pending: number
  available: number
  paid: number
  disputed: number
  reversed: number
}

/**
 * Sums every ledger entry (both "order" credits and "refund_reversal"
 * debits - a reversal's negative net_amount nets directly against
 * whichever bucket its original entry currently sits in) into the five
 * balance figures a seller/admin dashboard shows.
 */
export function summarizeSellerBalance(
  entries: Array<LedgerEntryLike & { reason: "order" | "refund_reversal" }>,
  now: Date = new Date()
): SellerBalanceSummary {
  const summary: SellerBalanceSummary = {
    pending: 0,
    available: 0,
    paid: 0,
    disputed: 0,
    reversed: 0,
  }

  for (const entry of entries) {
    if (entry.reason === "refund_reversal") {
      summary.reversed += entry.net_amount
    }
    const bucket = deriveLedgerBucket(entry, now)
    summary[bucket] += entry.net_amount
  }

  return summary
}
