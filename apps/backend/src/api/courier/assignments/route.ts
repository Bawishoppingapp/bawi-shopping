import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../modules/marketplace-order"
import type OrderModuleService from "../../../modules/marketplace-order/service"
import { shapeVendorOrderForCourier } from "../../../fulfillment/courier-assignment-response"

const ACTIVE_STATUSES = ["ready_for_pickup", "picked_up", "out_for_delivery"]

/**
 * Only this courier's own active assignments - scoped by
 * assigned_courier_id derived from the session, never a client-supplied
 * id (docs/USER-ROLES.md §2.7). Each row is shaped by
 * shapeVendorOrderForCourier(), which never surfaces the seller's real
 * identity, order financials, or any customer PII.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const courierId = req.auth_context.actor_id
  if (!courierId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const vendorOrders = await orderModuleService.listVendorOrders(
    { assigned_courier_id: courierId, status: ACTIVE_STATUSES },
    { order: { fulfillment_deadline_at: "ASC" } }
  )

  const shaped = await Promise.all(
    vendorOrders.map((vendorOrder) => shapeVendorOrderForCourier(req.scope, vendorOrder.id))
  )

  res.json({ assignments: shaped })
}
