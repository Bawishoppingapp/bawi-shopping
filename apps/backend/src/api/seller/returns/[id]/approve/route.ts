import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_FINANCE_MODULE } from "../../../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../../../modules/seller-finance/service"
import { shapeReturnRequestForSeller } from "../../../../../finance/return-request-response"
import { approveReturnRequestSchema } from "../../../../../finance/schemas"
import { resolveVendorId } from "../../../../seller/utils"
import { approveReturnRequestWorkflow } from "../../../../../workflows/approve-return-request"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const parsed = approveReturnRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" })
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
  if (returnRequest.status !== "requested") {
    res
      .status(422)
      .json({ message: `Cannot approve a return request with status "${returnRequest.status}"` })
    return
  }

  await approveReturnRequestWorkflow(req.scope).run({
    input: {
      returnRequestId: returnRequest.id,
      reviewerId: req.auth_context.actor_id,
      reviewerType: "seller_user",
      requestedAmount: parsed.data.requested_amount,
    },
  })

  const updated = await sellerFinanceModuleService.retrieveReturnRequest(returnRequest.id)
  res.json({ return_request: shapeReturnRequestForSeller(updated) })
}
