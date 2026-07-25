export type ProductListingStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived"

export const TERMINAL_STATUSES: ProductListingStatus[] = ["archived"]

const VALID_TRANSITIONS: Record<ProductListingStatus, ProductListingStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["approved", "rejected"],
  approved: ["archived"],
  rejected: ["draft"],
  archived: [],
}

/**
 * Pure state-machine check - no I/O, so it's directly unit-testable. A
 * rejected listing goes back to `draft` (not straight to `pending_review`)
 * so the seller has to actively resubmit after addressing the rejection
 * reason, rather than a stale draft silently re-entering review.
 */
export function isValidTransition(
  from: ProductListingStatus,
  to: ProductListingStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function isTerminal(status: ProductListingStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}
