import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"
import { createPayoutBatchSchema } from "../../../../finance/schemas"
import { createPayoutBatchWorkflow } from "../../../../workflows/create-payout-batch"

/** Admin-triggered payout batch for one seller - there is no background
 * job scheduler in this project (see docs/DECISIONS.md), so a real payout
 * run is always an explicit admin action, never automatic. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = createPayoutBatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" })
    return
  }

  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const seller = await sellerModuleService.retrieveSeller(parsed.data.vendor_id).catch(() => null)
  if (!seller) {
    res.status(404).json({ message: "Seller not found" })
    return
  }
  if (!seller.stripe_account_id || !seller.stripe_payouts_enabled) {
    res.status(422).json({ message: "Seller's Stripe account is not enabled for payouts" })
    return
  }

  const { result: payout } = await createPayoutBatchWorkflow(req.scope).run({
    input: { vendorId: seller.id, adminUserId: req.auth_context.actor_id },
  })

  if (!payout) {
    res.json({ payout: null, message: "No eligible ledger entries to pay out" })
    return
  }

  res.json({
    payout: {
      id: payout.id,
      amount: payout.amount,
      status: payout.status,
      stripe_transfer_id: payout.stripe_transfer_id,
      created_at: payout.created_at,
    },
  })
}
