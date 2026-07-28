import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_FINANCE_MODULE } from "../../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../../modules/seller-finance/service"
import { resolveVendorId } from "../../../seller/utils"

/** A seller's own payout history - never another seller's, and never a
 * Stripe transfer id for a payout that isn't theirs. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const sellerFinanceModuleService: SellerFinanceModuleService = req.scope.resolve(
    SELLER_FINANCE_MODULE
  )
  const payouts = await sellerFinanceModuleService.listPayouts(
    { vendor_id: vendorId },
    { order: { created_at: "DESC" } }
  )

  res.json({
    payouts: payouts.map((payout) => ({
      id: payout.id,
      amount: payout.amount,
      status: payout.status,
      stripe_transfer_id: payout.stripe_transfer_id,
      created_at: payout.created_at,
    })),
  })
}
