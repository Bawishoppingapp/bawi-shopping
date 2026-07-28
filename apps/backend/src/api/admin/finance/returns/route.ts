import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_FINANCE_MODULE } from "../../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../../modules/seller-finance/service"
import { shapeReturnRequestForAdmin } from "../../../../finance/return-request-response"

/** Admin-only, read-only oversight across every seller's return requests -
 * approval/denial itself stays with the seller (see /seller/returns/*),
 * this is visibility for support/dispute-review purposes. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const sellerFinanceModuleService: SellerFinanceModuleService = req.scope.resolve(
    SELLER_FINANCE_MODULE
  )
  const returnRequests = await sellerFinanceModuleService.listReturnRequests(
    {},
    { order: { created_at: "DESC" } }
  )

  res.json({ return_requests: returnRequests.map(shapeReturnRequestForAdmin) })
}
