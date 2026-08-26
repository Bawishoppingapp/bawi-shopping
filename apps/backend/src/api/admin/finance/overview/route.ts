import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_FINANCE_MODULE } from "../../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../../modules/seller-finance/service"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"
import { summarizeSellerBalance } from "../../../../finance/balance"

/** Admin-only (see middlewares.ts). Per-seller balance summary across
 * every seller with at least one ledger entry - the admin financial
 * dashboard's landing view (which sellers are accruing what, and which
 * are eligible for a payout batch right now).
 *
 * `platform_totals` is keyed by currency (`{ usd: {...}, etb: {...} }`),
 * never one blended number - summing a USD seller's cents with an ETB
 * seller's cents would silently produce a meaningless figure (see
 * docs/DECISIONS.md's Ethiopian-market entry). Every ledger entry
 * already carries its own `currency_code` (see Slice A of that same
 * entry), so this only ever fans an entry into the bucket matching its
 * own currency - it never converts or guesses.
 */
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
        { select: ["id", "name", "stripe_account_id", "stripe_payouts_enabled", "currency_code"] }
      )
    : []
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]))

  const platformTotals: Record<string, { pending: number; available: number; paid: number; disputed: number; reversed: number }> = {}
  const bySeller = vendorIds.map((vendorId) => {
    const vendorEntries = entriesByVendor.get(vendorId) ?? []
    const summary = summarizeSellerBalance(vendorEntries)
    const seller = sellerById.get(vendorId)
    const currencyCode = seller?.currency_code ?? vendorEntries[0]?.currency_code ?? "usd"

    const totalsBucket = platformTotals[currencyCode] ?? {
      pending: 0,
      available: 0,
      paid: 0,
      disputed: 0,
      reversed: 0,
    }
    totalsBucket.pending += summary.pending
    totalsBucket.available += summary.available
    totalsBucket.paid += summary.paid
    totalsBucket.disputed += summary.disputed
    totalsBucket.reversed += summary.reversed
    platformTotals[currencyCode] = totalsBucket

    return {
      vendor_id: vendorId,
      vendor_name: seller?.name ?? null,
      currency_code: currencyCode,
      payouts_enabled: Boolean(seller?.stripe_payouts_enabled),
      balance: summary,
    }
  })

  res.json({ platform_totals: platformTotals, sellers: bySeller })
}
