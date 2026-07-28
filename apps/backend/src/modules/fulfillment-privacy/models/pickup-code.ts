import { model } from "@medusajs/framework/utils"

/**
 * One-time pickup QR/code, issued when a vendor_order transitions to
 * ready_for_pickup, scanned/entered by the assigned courier to confirm
 * pickup from the seller. `vendor_order_id` is a plain reference (not a
 * DML relation - fulfillment-privacy and marketplace-order are separate
 * modules, see docs/DECISIONS.md), unique among non-deleted rows so a
 * given vendor_order has at most one *active* code at a time; an expired,
 * never-used code is soft-deleted before a replacement is issued.
 *
 * Single-use is enforced by a separate `FulfillmentCodeRedemption` claim
 * row (unique-index INSERT, same pattern as `webhook-event`/`cart-merge`),
 * not by flipping a status column here - see docs/DECISIONS.md for why an
 * UPDATE-based conditional claim isn't safe under concurrency in this
 * codebase.
 */
export const PickupCode = model.define("pickup_code", {
  id: model.id().primaryKey(),
  vendor_order_id: model.text().unique(),
  code: model.text().unique(),
  expires_at: model.dateTime(),
})
