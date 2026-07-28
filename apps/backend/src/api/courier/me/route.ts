import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FULFILLMENT_PRIVACY_MODULE } from "../../../modules/fulfillment-privacy"
import type FulfillmentPrivacyModuleService from "../../../modules/fulfillment-privacy/service"

/** Same pattern as GET /seller/me - for the "courier" actor type, Medusa
 * sets auth_context.actor_id to app_metadata.courier_id (see
 * courier-activation/complete/route.ts). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const courierId = req.auth_context.actor_id
  if (!courierId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = req.scope.resolve(
    FULFILLMENT_PRIVACY_MODULE
  )
  const courier = await fulfillmentPrivacyModuleService.retrieveCourier(courierId)

  res.json({ courier: { id: courier.id, name: courier.name } })
}
