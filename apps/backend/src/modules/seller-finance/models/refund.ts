import { model } from "@medusajs/framework/utils"

/**
 * Named OrderRefund (table order_refund), not Refund - Medusa's own
 * native order/payment modules already define a "Refund" GraphQL type
 * with a differently-typed `amount` field, and schema merging fails if a
 * custom module reuses that exact type name (same class of collision as
 * naming a module "order" in the checkout slice - see docs/DECISIONS.md).
 *
 * Always computed server-side from stored order/item data - never a
 * client-supplied amount (docs/PAYMENTS.md §"What the platform never
 * does"). `amount` is capped by the originating item's line_total; a
 * return_request has at most one refund. `return_request_id` is nullable
 * because a pre-preparation cancellation (see cancel-vendor-order.ts)
 * also produces a full refund with no return request behind it - Postgres
 * unique constraints don't count NULLs against each other, so this still
 * enforces "at most one refund per return request" for the rows that do
 * have one.
 */
export const OrderRefund = model.define("order_refund", {
  id: model.id().primaryKey(),
  return_request_id: model.text().unique().nullable(),
  order_id: model.text(),
  vendor_order_id: model.text(),
  amount: model.number(),
  is_partial: model.boolean(),
  stripe_refund_id: model.text().unique().nullable(),
  status: model.enum(["pending", "succeeded", "failed"]).default("pending"),
})
