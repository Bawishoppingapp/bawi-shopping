import crypto from "node:crypto"

/**
 * Human-facing order number shown to the customer (confirmation page,
 * order history) - never used for authorization, every route still
 * checks customer_id server-side. Date-prefixed for readability, not for
 * uniqueness (the random suffix guarantees that).
 */
export function generateOrderDisplayId(now: Date = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "")
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `BW-${datePart}-${suffix}`
}
