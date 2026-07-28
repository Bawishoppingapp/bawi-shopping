import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_FINANCE_MODULE } from "../../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../../modules/seller-finance/service"
import { summarizeSellerBalance } from "../../../../finance/balance"
import { resolveVendorId } from "../../../seller/utils"

/** A seller's own commission-ledger balance summary, bucketed exactly the
 * way the payout workflow buckets it - see src/finance/balance.ts. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const sellerFinanceModuleService: SellerFinanceModuleService = req.scope.resolve(
    SELLER_FINANCE_MODULE
  )
  const entries = await sellerFinanceModuleService.listCommissionLedgerEntries({
    vendor_id: vendorId,
  })

  res.json({ balance: summarizeSellerBalance(entries) })
}
