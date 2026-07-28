import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETPLACE_ORDER_MODULE } from "../../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../../modules/marketplace-order/service"
import { shapeVendorOrderForCourier } from "../../../../../fulfillment/courier-assignment-response"
import { submitCodeSchema } from "../../../../../fulfillment/schemas"
import { confirmVendorOrderDeliveryWorkflow } from "../../../../../workflows/confirm-vendor-order-delivery"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const courierId = req.auth_context.actor_id
  if (!courierId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const parsed = submitCodeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" })
    return
  }

  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const vendorOrder = await orderModuleService.retrieveVendorOrder(req.params.id).catch(() => null)
  if (!vendorOrder || vendorOrder.assigned_courier_id !== courierId) {
    res.status(404).json({ message: "Assignment not found" })
    return
  }
  if (vendorOrder.status !== "out_for_delivery") {
    res
      .status(422)
      .json({ message: `Cannot confirm delivery from status "${vendorOrder.status}"` })
    return
  }

  try {
    await confirmVendorOrderDeliveryWorkflow(req.scope).run({
      input: { vendorOrderId: vendorOrder.id, submittedCode: parsed.data.code, courierId },
    })
  } catch (error) {
    if (error instanceof MedusaError && error.type === MedusaError.Types.INVALID_DATA) {
      res.status(422).json({ message: error.message })
      return
    }
    res.status(500).json({ message: "Could not confirm delivery" })
    return
  }

  const shaped = await shapeVendorOrderForCourier(req.scope, vendorOrder.id)
  res.json({ assignment: shaped })
}
