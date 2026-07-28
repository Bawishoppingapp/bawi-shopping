import { model } from "@medusajs/framework/utils"

/**
 * The atomic single-use claim for a `pickup_code` or `tracking_code` -
 * `code_id` unique (a plain reference to either table's id; both are
 * globally-unique ULIDs, so one column safely covers both without a
 * composite key). A courier's redemption attempt tries to INSERT a row
 * keyed by `code_id`; success means this call is the one that gets to
 * apply the pickup/delivery side effect, a unique-constraint violation
 * means the code was already redeemed (replay) - same proven pattern as
 * `WebhookEventModuleService.markProcessed()` and `CartMergeModuleService.claim()`,
 * not an UPDATE-based conditional claim (see docs/DECISIONS.md).
 */
export const FulfillmentCodeRedemption = model.define("fulfillment_code_redemption", {
  id: model.id().primaryKey(),
  code_type: model.enum(["pickup", "tracking"]),
  code_id: model.text().unique(),
  courier_id: model.text(),
  redeemed_at: model.dateTime(),
})
