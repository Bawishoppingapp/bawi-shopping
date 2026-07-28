import { model } from "@medusajs/framework/utils"
import { Payout } from "./payout"

/**
 * `commission_ledger_entry_id` is unique among non-deleted rows - a
 * ledger entry can be included in at most one payout, ever, which is
 * what makes re-running the payout-batch selection safe against
 * double-selecting the same entry (see docs/DECISIONS.md).
 */
export const PayoutLineItem = model.define("payout_line_item", {
  id: model.id().primaryKey(),
  commission_ledger_entry_id: model.text().unique(),
  amount: model.number(),
  payout: model.belongsTo(() => Payout, { mappedBy: "line_items" }),
})
