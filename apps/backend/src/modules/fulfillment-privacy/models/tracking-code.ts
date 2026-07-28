import { model } from "@medusajs/framework/utils"

/**
 * The customer's own delivery-confirmation code (proof of delivery),
 * distinct from `pickup_code` - issued at the same time (ready_for_pickup)
 * but consumed at the *end* of the courier's handoff, not the start. The
 * customer sees this code on their order-tracking page and shares it with
 * the courier at the door; the courier never sees it in advance, only
 * submits what the customer gave them for server-side verification - see
 * docs/DECISIONS.md.
 */
export const TrackingCode = model.define("tracking_code", {
  id: model.id().primaryKey(),
  vendor_order_id: model.text().unique(),
  code: model.text().unique(),
  expires_at: model.dateTime(),
})
