import { model } from "@medusajs/framework/utils"
import { MarketplaceOrder } from "./order"
import { VendorOrderItem } from "./vendor-order-item"

/**
 * One per seller represented in a paid Order - created only after payment
 * capture succeeds (never before, so a seller's dashboard never shows an
 * order that might not end up paid - see docs/MARKETPLACE-FLOWS.md §3).
 * `vendor_id` is a plain reference to seller.id, not a Medusa DML relation
 * - the order and seller modules are separate modules, and a DML relation
 * only works within one module (same loose-coupling pattern as
 * product_listing.vendor_id - see docs/DECISIONS.md).
 */
export const VendorOrder = model.define("vendor_order", {
  id: model.id().primaryKey(),
  vendor_id: model.text(),
  status: model
    .enum([
      "awaiting_preparation",
      "preparing",
      "ready_for_pickup",
      "picked_up",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "returned",
    ])
    .default("awaiting_preparation"),
  subtotal_amount: model.number(),
  shipping_amount: model.number(),
  tax_amount: model.number(),
  // Commission snapshot - resolved (seller override -> category default ->
  // platform default) and frozen at creation time, per docs/PAYMENTS.md §4.
  // A later Batch (payouts/ledger) reads these two fields rather than
  // re-resolving the rate, so a subsequent business-config change never
  // retroactively alters an order already placed.
  commission_rate_basis_points: model.number(),
  commission_amount: model.number(),
  total_amount: model.number(),
  // Opaque, seller-facing reference for this portion of the order (shown
  // on the seller dashboard and printed on neutral Bawi packaging) -
  // distinct from the pickup QR/tracking codes planned for the private-
  // fulfillment batch (see docs/DATABASE.md "planned" tables).
  fulfillment_code: model.text().unique(),
  fulfillment_deadline_at: model.dateTime(),
  order: model.belongsTo(() => MarketplaceOrder, { mappedBy: "vendor_orders" }),
  items: model.hasMany(() => VendorOrderItem, { mappedBy: "vendor_order" }),
})
