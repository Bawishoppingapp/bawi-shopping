import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_FINANCE_MODULE } from "../../../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../../../modules/seller-finance/service"
import { SELLER_MODULE } from "../../../../../modules/seller"
import type SellerModuleService from "../../../../../modules/seller/service"
import { summarizeSellerBalance } from "../../../../../finance/balance"

/** Admin-only. One seller's full financial detail: balance breakdown plus
 * payout history - the drill-down from GET /admin/finance/overview. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const seller = await sellerModuleService.retrieveSeller(req.params.id).catch(() => null)
  if (!seller) {
    res.status(404).json({ message: "Seller not found" })
    return
  }

  const sellerFinanceModuleService: SellerFinanceModuleService = req.scope.resolve(
    SELLER_FINANCE_MODULE
  )
  const entries = await sellerFinanceModuleService.listCommissionLedgerEntries({
    vendor_id: seller.id,
  })
  const payouts = await sellerFinanceModuleService.listPayouts(
    { vendor_id: seller.id },
    { order: { created_at: "DESC" } }
  )

  res.json({
    seller: {
      id: seller.id,
      name: seller.name,
      stripe_payouts_enabled: seller.stripe_payouts_enabled,
    },
    balance: summarizeSellerBalance(entries),
    payouts: payouts.map((payout) => ({
      id: payout.id,
      amount: payout.amount,
      status: payout.status,
      stripe_transfer_id: payout.stripe_transfer_id,
      created_at: payout.created_at,
    })),
  })
}
