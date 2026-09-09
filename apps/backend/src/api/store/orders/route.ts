import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../modules/marketplace-order"
import type OrderModuleService from "../../../modules/marketplace-order/service"

/** The authenticated customer's own order history - never accepts or
 * trusts a client-supplied customer id, always the session's own actor_id
 * (docs/SECURITY.md). Only paid orders are meaningful order history; a
 * pending/failed checkout attempt isn't shown here. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id
  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)

  const orders = await orderModuleService.listMarketplaceOrders(
    { customer_id: customerId },
    { order: { created_at: "DESC" } }
  )

  res.json({
    orders: orders.map((order) => ({
      id: order.id,
      display_id: order.display_id,
      status: order.status,
      payment_status: order.payment_status,
      total: order.total_amount,
      currency_code: order.currency_code,
      created_at: order.created_at,
    })),
  })
}
