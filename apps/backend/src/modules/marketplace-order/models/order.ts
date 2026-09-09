import { model } from "@medusajs/framework/utils"
import { VendorOrder } from "./vendor-order"

/**
 * The customer-facing, cross-vendor parent order - one per successful
 * checkout, regardless of how many sellers are represented in the cart
 * (see docs/MARKETPLACE-FLOWS.md §3). Payment lives directly on this row
 * (stripe_payment_intent_id/payment_status) rather than a separate
 * `payment` module/table as originally sketched in docs/DATABASE.md - an
 * Order has exactly one PaymentIntent, so a join for a 1:1 relationship
 * would be pure overhead (same reasoning as seller_user.role being a plain
 * enum column instead of a join table - see docs/DECISIONS.md).
 */
// Named MarketplaceOrder (table marketplace_order, not order/Order) -
// Medusa's framework reserves the "order" module/table/entity name for its
// own native commerce module even though this project doesn't use it (see
// docs/DECISIONS.md). MedusaService derives generated CRUD method names
// (createMarketplaceOrders, retrieveMarketplaceOrder, ...) from this
// export name, not from the table-name string passed to model.define().
export const MarketplaceOrder = model.define("marketplace_order", {
  id: model.id().primaryKey(),
  // Human-facing order number shown to the customer - distinct from `id`,
  // never used for authorization (every route still checks customer_id).
  display_id: model.text().unique(),
  customer_id: model.text(),
  currency_code: model.text().default("etb"),
  status: model
    .enum(["pending_payment", "paid", "payment_failed", "cancelled"])
    .default("pending_payment"),
  // Client-generated, one per checkout attempt - a retried submission with
  // the same key returns the existing order/PaymentIntent instead of
  // creating a second one (see docs/MARKETPLACE-FLOWS.md §1 edge cases).
  idempotency_key: model.text().unique(),
  subtotal_amount: model.number(),
  shipping_amount: model.number(),
  tax_amount: model.number(),
  // Snapshotted at checkout-start so a later business-config rate change
  // never retroactively alters an order already in flight (same
  // snapshotting principle as the transfer-hold period - see
  // docs/PAYMENTS.md §5, docs/DECISIONS.md).
  tax_rate_basis_points: model.number(),
  total_amount: model.number(),
  // { first_name, last_name, address_1, address_2?, city, province,
  // postal_code, country_code, phone } - collected inline at checkout, not
  // yet a reusable saved-address record (see docs/DECISIONS.md; saved
  // addresses are explicitly a later-batch customer-portal feature).
  shipping_address: model.json(),
  // Cart contents as of checkout-start (variant/vendor/price/qty per
  // line), frozen here so the per-vendor split at payment-capture time
  // never has to trust whatever the live cart looks like by then - the
  // cart could have been modified or cleared in between.
  line_items_snapshot: model.json(),
  // Inventory reservation-item ids created at checkout-start, released
  // (never finalized) if payment fails/is abandoned; cleared once
  // finalized into a real deduction on capture.
  reservation_item_ids: model.json().nullable(),
  stripe_payment_intent_id: model.text().unique().nullable(),
  payment_method: model.text().default("manual_telebirr"),
  payment_reference: model.text().unique().nullable(),
  payment_proof_url: model.text().nullable(),
  payment_recipient_name: model.text().nullable(),
  payment_recipient_phone: model.text().nullable(),
  payment_submitted_at: model.dateTime().nullable(),
  payment_reviewed_by: model.text().nullable(),
  payment_reviewed_at: model.dateTime().nullable(),
  payment_rejection_reason: model.text().nullable(),
  payment_status: model
    .enum([
      "pending",
      "requires_action",
      "proof_submitted",
      "under_review",
      "succeeded",
      "rejected",
      "failed",
      "canceled",
    ])
    .default("pending"),
  vendor_orders: model.hasMany(() => VendorOrder, { mappedBy: "order" }),
})
