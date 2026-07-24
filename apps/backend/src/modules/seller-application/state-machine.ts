export type SellerApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "withdrawn"

export const TERMINAL_STATUSES: SellerApplicationStatus[] = [
  "approved",
  "rejected",
  "withdrawn",
]

const VALID_TRANSITIONS: Record<SellerApplicationStatus, SellerApplicationStatus[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "approved", "rejected", "withdrawn"],
  under_review: ["approved", "rejected", "withdrawn"],
  approved: [],
  rejected: [],
  withdrawn: [],
}

/**
 * Pure state-machine check - no I/O, so it's directly unit-testable. Used
 * by the approve/reject route handlers before touching the database, so an
 * invalid transition (e.g. approving an already-rejected application) is
 * rejected deterministically rather than relying on a database constraint.
 */
export function isValidTransition(
  from: SellerApplicationStatus,
  to: SellerApplicationStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function isTerminal(status: SellerApplicationStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}
