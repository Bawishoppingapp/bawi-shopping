import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../modules/marketplace-order/service"
import { shapeOrderForCustomer } from "../../../../orders/order-response"

/** Order detail / confirmation page data - ownership-checked against the
 * authenticated customer's own actor_id before anything is returned, same
 * discipline as every other seller/customer-scoped record in this
 * codebase (docs/SECURITY.md). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id
  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)

  const order = await orderModuleService.retrieveMarketplaceOrder(req.params.id).catch(() => null)
  if (!order || order.customer_id !== customerId) {
    res.status(404).json({ message: "Order not found" })
    return
  }

  const shaped = await shapeOrderForCustomer(req.scope, order.id)
  res.json({ order: shaped })
}
