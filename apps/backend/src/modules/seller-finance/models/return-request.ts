import { model } from "@medusajs/framework/utils"

/**
 * One per customer request to return a single vendor_order_item. Reason
 * drives the return-shipping-responsibility display (damaged/defective/
 * incorrect: seller-caused, customer doesn't pay return shipping;
 * customer_remorse: customer pays - see business-config `returns`
 * category, docs/DECISIONS.md) and whether inventory is restocked on
 * refund (damaged/defective are not restocked; incorrect/customer_remorse
 * are, since the item itself is presumably resellable).
 */
export const ReturnRequest = model.define("return_request", {
  id: model.id().primaryKey(),
  vendor_order_item_id: model.text(),
  vendor_order_id: model.text(),
  vendor_id: model.text(),
  order_id: model.text(),
  customer_id: model.text(),
  reason: model.enum(["damaged", "defective", "incorrect", "customer_remorse"]),
  customer_comment: model.text().nullable(),
  status: model.enum(["requested", "approved", "denied", "refunded"]).default("requested"),
  // Private - never returned from a customer-facing endpoint (same tier
  // as seller_application.rejection_reason).
  seller_response: model.text().nullable(),
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
})
