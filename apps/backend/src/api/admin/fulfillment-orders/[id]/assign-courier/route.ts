import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../../modules/marketplace-order/service"
import { FULFILLMENT_PRIVACY_MODULE } from "../../../../../modules/fulfillment-privacy"
import type FulfillmentPrivacyModuleService from "../../../../../modules/fulfillment-privacy/service"
import { assignCourierSchema } from "../../../../../fulfillment/schemas"
import { assignCourierToVendorOrderWorkflow } from "../../../../../workflows/assign-courier-to-vendor-order"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = assignCourierSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" })
    return
  }

  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const vendorOrder = await orderModuleService.retrieveVendorOrder(req.params.id).catch(() => null)
  if (!vendorOrder) {
    res.status(404).json({ message: "Fulfillment order not found" })
    return
  }
  if (vendorOrder.status !== "ready_for_pickup") {
    res
      .status(422)
      .json({ message: `Cannot assign a courier while status is "${vendorOrder.status}"` })
    return
  }

  const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = req.scope.resolve(
    FULFILLMENT_PRIVACY_MODULE
  )
  const courier = await fulfillmentPrivacyModuleService
    .retrieveCourier(parsed.data.courier_id)
    .catch(() => null)
  if (!courier || courier.status !== "active") {
    res.status(422).json({ message: "Courier not found or inactive" })
    return
  }

  const { result } = await assignCourierToVendorOrderWorkflow(req.scope).run({
    input: {
      vendorOrderId: vendorOrder.id,
      courierId: courier.id,
      adminUserId: req.auth_context.actor_id,
    },
  })

  res.json({
    fulfillment_order: {
      id: result.id,
      status: result.status,
      assigned_courier_id: result.assigned_courier_id,
    },
  })
}
