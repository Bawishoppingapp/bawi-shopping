import { model } from "@medusajs/framework/utils"
import { PayoutLineItem } from "./payout-line-item"

/**
 * One per admin-triggered payout batch run for one seller (see
 * docs/DECISIONS.md - no background job scheduler exists yet, so this is
 * an admin action, not a real cron). `idempotency_key` guards against a
 * double-submitted batch creating two Stripe Transfers for the same
 * selection of ledger entries.
 */
export const Payout = model.define("payout", {
  id: model.id().primaryKey(),
  vendor_id: model.text(),
  idempotency_key: model.text().unique(),
  // A seller only ever has one currency (see Seller.currency_code), so
  // every ledger entry a batch pulls in already shares this value -
  // stamped here too so a batch can never silently mix currencies if
  // that assumption is ever violated. Backfilled "usd" for existing rows.
  currency_code: model.enum(["usd", "etb"]).default("usd"),
  amount: model.number(),
  status: model.enum(["pending", "paid", "failed"]).default("pending"),
  stripe_transfer_id: model.text().unique().nullable(),
  // Set by an admin "reconcile" action that re-fetches the Transfer's
  // current status from Stripe - see docs/DECISIONS.md (no scheduler
  // exists to do this automatically yet).
  reconciled_at: model.dateTime().nullable(),
  line_items: model.hasMany(() => PayoutLineItem, { mappedBy: "payout" }),
})
