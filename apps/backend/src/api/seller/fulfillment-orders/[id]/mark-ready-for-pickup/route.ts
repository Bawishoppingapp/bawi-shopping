import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../../modules/marketplace-order/service"
import { shapeVendorOrderForSeller } from "../../../../../fulfillment/seller-fulfillment-response"
import { resolveVendorId } from "../../../../seller/utils"
import { markVendorOrderReadyForPickupWorkflow } from "../../../../../workflows/mark-vendor-order-ready-for-pickup"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const vendorOrder = await orderModuleService.retrieveVendorOrder(req.params.id).catch(() => null)
  if (!vendorOrder || vendorOrder.vendor_id !== vendorId) {
    res.status(404).json({ message: "Fulfillment order not found" })
    return
  }
  if (vendorOrder.status !== "preparing") {
    res
      .status(422)
      .json({ message: `Cannot mark ready for pickup from status "${vendorOrder.status}"` })
    return
  }

  await markVendorOrderReadyForPickupWorkflow(req.scope).run({
    input: { vendorOrderId: vendorOrder.id, sellerUserId: req.auth_context.actor_id },
  })

  const shaped = await shapeVendorOrderForSeller(req.scope, vendorOrder.id)
  res.json({ fulfillment_order: shaped })
}
