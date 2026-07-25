export interface QuantityLimits {
  availableQuantity: number
  maxQuantityPerLineItem: number
}

export type QuantityRejectionReason = "invalid" | "exceeds_max" | "exceeds_inventory"

export type QuantityValidationResult =
  | { ok: true }
  | { ok: false; reason: QuantityRejectionReason }

/**
 * Pure validation, no I/O - quantity must be a positive whole number,
 * within the configurable per-line-item maximum, and within currently
 * available inventory. Exceeding either limit is a hard rejection, not a
 * silent clamp, so the customer always knows what they actually got.
 */
export function validateRequestedQuantity(
  quantity: number,
  limits: QuantityLimits
): QuantityValidationResult {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, reason: "invalid" }
  }
  if (quantity > limits.maxQuantityPerLineItem) {
    return { ok: false, reason: "exceeds_max" }
  }
  if (quantity > limits.availableQuantity) {
    return { ok: false, reason: "exceeds_inventory" }
  }
  return { ok: true }
}
