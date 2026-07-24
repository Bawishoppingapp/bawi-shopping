import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SELLER_APPLICATION_MODULE } from "../../../../modules/seller-application"
import type SellerApplicationModuleService from "../../../../modules/seller-application/service"

/** Admin-only full detail, including rejection_reason and reviewer info. */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const sellerApplicationModuleService: SellerApplicationModuleService =
    req.scope.resolve(SELLER_APPLICATION_MODULE)

  try {
    const application = await sellerApplicationModuleService.retrieveSellerApplication(
      req.params.id
    )
    res.json({ application })
  } catch {
    res.status(404).json({ message: "Application not found" })
  }
}
