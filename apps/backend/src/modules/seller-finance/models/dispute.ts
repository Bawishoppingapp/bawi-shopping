import { model } from "@medusajs/framework/utils"

/**
 * Tracks a Stripe payment dispute (chargeback) against an order - created
 * from the `charge.dispute.created` webhook (never client-initiated), and
 * updated from `charge.dispute.closed`. While open, the associated
 * commission_ledger_entry is frozen (`disputed_at` set) so it can't be
 * paid out until the dispute resolves.
 */
export const Dispute = model.define("dispute", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  vendor_order_id: model.text().nullable(),
  stripe_dispute_id: model.text().unique(),
  amount: model.number(),
  reason: model.text().nullable(),
  status: model.enum(["open", "won", "lost"]).default("open"),
  resolved_at: model.dateTime().nullable(),
})
