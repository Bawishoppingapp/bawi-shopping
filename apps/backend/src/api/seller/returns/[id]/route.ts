import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_FINANCE_MODULE } from "../../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../../modules/seller-finance/service"
import { shapeReturnRequestForSeller } from "../../../../finance/return-request-response"
import { resolveVendorId } from "../../../seller/utils"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const sellerFinanceModuleService: SellerFinanceModuleService = req.scope.resolve(
    SELLER_FINANCE_MODULE
  )
  const returnRequest = await sellerFinanceModuleService
    .retrieveReturnRequest(req.params.id)
    .catch(() => null)
  if (!returnRequest || returnRequest.vendor_id !== vendorId) {
    res.status(404).json({ message: "Return request not found" })
    return
  }

  res.json({ return_request: shapeReturnRequestForSeller(returnRequest) })
}
