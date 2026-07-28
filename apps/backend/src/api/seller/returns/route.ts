import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_FINANCE_MODULE } from "../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../modules/seller-finance/service"
import { shapeReturnRequestForSeller } from "../../../finance/return-request-response"
import { resolveVendorId } from "../../seller/utils"

/** Return requests against this seller's own vendor_orders only. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const sellerFinanceModuleService: SellerFinanceModuleService = req.scope.resolve(
    SELLER_FINANCE_MODULE
  )
  const returnRequests = await sellerFinanceModuleService.listReturnRequests(
    { vendor_id: vendorId },
    { order: { created_at: "DESC" } }
  )

  res.json({ return_requests: returnRequests.map(shapeReturnRequestForSeller) })
}
