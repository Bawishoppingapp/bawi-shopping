import { model } from "@medusajs/framework/utils"

/**
 * One row per vendor_order at capture time (reason: "order"), plus one
 * additional negative row per refund (reason: "refund_reversal") -
 * never mutated after creation, only ever added to (an append-only
 * ledger, same convention as audit_log). `net_amount` is what actually
 * moves the seller's balance (subtotal minus commission - shipping and
 * tax are Bawi's own revenue/pass-through, not the seller's, since Bawi
 * operates fulfillment/delivery - see docs/DECISIONS.md); `commission_amount`
 * is kept alongside purely for reporting/audit, not balance math.
 *
 * `available_at` is null until the vendor_order is delivered (set then,
 * as delivered_at + the *snapshotted* transfer_hold_days - never
 * re-read live from business-config, so a later config change never
 * retroactively alters an order already in flight). A row's bucket
 * (pending|available|paid|disputed) is derived at read time from
 * `available_at`/`paid_at`/`disputed_at`, not stored as a mutable status
 * column - there's no background scheduler in this project to keep a
 * stored status in sync, and deriving it is both simpler and always
 * correct (see docs/DECISIONS.md).
 */
export const CommissionLedgerEntry = model.define("commission_ledger_entry", {
  id: model.id().primaryKey(),
  vendor_order_id: model.text(),
  vendor_id: model.text(),
  reason: model.enum(["order", "refund_reversal"]),
  commission_rate_basis_points: model.number(),
  commission_amount: model.number(),
  net_amount: model.number(),
  transfer_hold_days_snapshot: model.number(),
  available_at: model.dateTime().nullable(),
  paid_at: model.dateTime().nullable(),
  disputed_at: model.dateTime().nullable(),
  dispute_resolved_at: model.dateTime().nullable(),
  // Set on a refund_reversal row - which original "order" row this
  // reverses, for traceability.
  reverses_entry_id: model.text().nullable(),
})
