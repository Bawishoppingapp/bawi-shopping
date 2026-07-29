export type ProductTranslationStatus = "draft" | "pending_review" | "approved" | "rejected"

const VALID_TRANSITIONS: Record<ProductTranslationStatus, ProductTranslationStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["approved", "rejected"],
  approved: [],
  rejected: ["draft"],
}

/**
 * Same shape as product_listing's own state machine (see docs/DECISIONS.md
 * "same moderation shape as products", CLAUDE.md §Localization) - a
 * rejected translation goes back to `draft`, not straight to
 * `pending_review`, so the seller has to actively resubmit rather than a
 * stale draft silently re-entering review. No `archived` state here (that
 * concept belongs to the whole product, not one locale's translation).
 */
export function isValidTransition(
  from: ProductTranslationStatus,
  to: ProductTranslationStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}
