import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../../modules/marketplace-order/service"
import { shapeVendorOrderForCourier } from "../../../../../fulfillment/courier-assignment-response"
import { startVendorOrderDeliveryWorkflow } from "../../../../../workflows/start-vendor-order-delivery"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const courierId = req.auth_context.actor_id
  if (!courierId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const vendorOrder = await orderModuleService.retrieveVendorOrder(req.params.id).catch(() => null)
  if (!vendorOrder || vendorOrder.assigned_courier_id !== courierId) {
    res.status(404).json({ message: "Assignment not found" })
    return
  }
  if (vendorOrder.status !== "picked_up") {
    res
      .status(422)
      .json({ message: `Cannot start delivery from status "${vendorOrder.status}"` })
    return
  }

  await startVendorOrderDeliveryWorkflow(req.scope).run({
    input: { vendorOrderId: vendorOrder.id, courierId },
  })

  const shaped = await shapeVendorOrderForCourier(req.scope, vendorOrder.id)
  res.json({ assignment: shaped })
}
