import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_FINANCE_MODULE } from "../../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../../modules/seller-finance/service"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"
import { summarizeSellerBalance } from "../../../../finance/balance"

/** Admin-only (see middlewares.ts). Per-seller balance summary across
 * every seller with at least one ledger entry - the admin financial
 * dashboard's landing view (which sellers are accruing what, and which
 * are eligible for a payout batch right now). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const sellerFinanceModuleService: SellerFinanceModuleService = req.scope.resolve(
    SELLER_FINANCE_MODULE
  )
  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)

  const entries = await sellerFinanceModuleService.listCommissionLedgerEntries({})
  const entriesByVendor = new Map<string, typeof entries>()
  for (const entry of entries) {
    const bucket = entriesByVendor.get(entry.vendor_id) ?? []
    bucket.push(entry)
    entriesByVendor.set(entry.vendor_id, bucket)
  }

  const vendorIds = Array.from(entriesByVendor.keys())
  const sellers = vendorIds.length
    ? await sellerModuleService.listSellers(
        { id: vendorIds },
        { select: ["id", "name", "stripe_account_id", "stripe_payouts_enabled"] }
      )
    : []
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]))

  const platformTotals = { pending: 0, available: 0, paid: 0, disputed: 0, reversed: 0 }
  const bySeller = vendorIds.map((vendorId) => {
    const summary = summarizeSellerBalance(entriesByVendor.get(vendorId) ?? [])
    platformTotals.pending += summary.pending
    platformTotals.available += summary.available
    platformTotals.paid += summary.paid
    platformTotals.disputed += summary.disputed
    platformTotals.reversed += summary.reversed

    const seller = sellerById.get(vendorId)
    return {
      vendor_id: vendorId,
      vendor_name: seller?.name ?? null,
      payouts_enabled: Boolean(seller?.stripe_payouts_enabled),
      balance: summary,
    }
  })

  res.json({ platform_totals: platformTotals, sellers: bySeller })
}
