import { model } from "@medusajs/framework/utils"
import { VendorOrder } from "./vendor-order"

/**
 * One row per cart line item that belonged to this vendor at checkout
 * time. Every product-identifying field is a snapshot (title, color,
 * size, unit price, product_code) - never a live join back to the
 * product/variant, so a later product edit, repricing, or deletion can
 * never alter what an already-placed order shows (see docs/DECISIONS.md
 * snapshotting principle, applied here the same way as the transfer-hold
 * period and commission rate).
 */
export const VendorOrderItem = model.define("vendor_order_item", {
  id: model.id().primaryKey(),
  // Denormalized (also reachable via vendor_order.vendor_id) so a scoped
  // query never needs a join through the parent to enforce isolation -
  // same reasoning as product_listing/vendor_order_item in docs/DATABASE.md
  // §5.
  vendor_id: model.text(),
  variant_id: model.text().nullable(),
  product_id: model.text().nullable(),
  product_code: model.text().nullable(),
  title: model.text(),
  thumbnail: model.text().nullable(),
  color: model.text().nullable(),
  size: model.text().nullable(),
  unit_price_amount: model.number(),
  quantity: model.number(),
  line_total_amount: model.number(),
  vendor_order: model.belongsTo(() => VendorOrder, { mappedBy: "items" }),
})
