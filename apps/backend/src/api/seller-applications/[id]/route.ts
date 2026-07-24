import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_APPLICATION_MODULE } from "../../../modules/seller-application"
import type SellerApplicationModuleService from "../../../modules/seller-application/service"

/**
 * Public status-check endpoint for an applicant to see where their own
 * application stands. Deliberately returns a narrow field set - never
 * rejection_reason (private, see docs/SECURITY.md), reviewed_by, or any
 * other internal reviewer detail.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const sellerApplicationModuleService: SellerApplicationModuleService =
    req.scope.resolve(SELLER_APPLICATION_MODULE)

  try {
    const application = await sellerApplicationModuleService.retrieveSellerApplication(
      req.params.id
    )

    res.json({
      application: {
        id: application.id,
        store_name: application.store_name,
        status: application.status,
        submitted_at: application.submitted_at,
      },
    })
  } catch {
    res.status(404).json({ message: "Application not found" })
  }
}
