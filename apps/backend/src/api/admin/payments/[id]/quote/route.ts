import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_ORDER_MODULE } from "../../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../../modules/marketplace-order/service"
import { AUDIT_LOG_MODULE } from "../../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../../modules/audit-log/service"
import { recordNotification } from "../../../../../notifications/record-notification"

const schema = z.object({ shipping_amount: z.number().int().min(0).max(100_000_000) })

/** Sets the courier's ETB-cent delivery quote before the customer pays. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Enter a valid delivery quote in ETB cents." })
    return
  }

  const orders: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const order = await orders.retrieveMarketplaceOrder(req.params.id).catch(() => null)
  if (!order) { res.status(404).json({ message: "Order not found" }); return }
  if (order.status !== "pending_quote" || order.payment_status !== "pending") {
    res.status(409).json({ message: "This order is no longer awaiting a delivery quote." })
    return
  }

  const totalAmount = order.subtotal_amount + order.tax_amount + parsed.data.shipping_amount
  await orders.updateMarketplaceOrders({
    id: order.id,
    status: "pending_payment",
    shipping_amount: parsed.data.shipping_amount,
    total_amount: totalAmount,
  })

  const audit: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  await audit.record({
    actorType: "user", actorId: req.auth_context.actor_id,
    action: "delivery.quote_set", entityType: "order", entityId: order.id,
    beforeState: { status: order.status, shipping_amount: order.shipping_amount },
    afterState: { status: "pending_payment", shipping_amount: parsed.data.shipping_amount, total_amount: totalAmount },
  })

  try {
    const customers = req.scope.resolve(Modules.CUSTOMER)
    const customer = await customers.retrieveCustomer(order.customer_id)
    if (customer.email) {
      await recordNotification(req.scope, {
        idempotencyKey: `delivery_quote_ready:${order.id}`,
        eventType: "delivery_quote_ready",
        to: customer.email,
        subject: `Delivery quote ready for Bawi order ${order.display_id}`,
        body: `Your delivery quote is ready. Open order ${order.display_id} in Bawi Shopping to review the full amount and pay by Telebirr.`,
        recipientType: "customer", recipientId: order.customer_id,
        resourceId: order.id, resourceType: "order",
      })
    }
  } catch {
    // The quote is committed; a notification outage must not roll it back.
  }

  res.json({ order_id: order.id, status: "pending_payment", shipping: parsed.data.shipping_amount, total: totalAmount })
}
