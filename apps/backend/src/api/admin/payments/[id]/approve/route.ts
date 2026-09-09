import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../../modules/marketplace-order/service"
import { captureCheckoutPaymentWorkflow } from "../../../../../workflows/capture-checkout-payment"
import type { CheckoutLineItemSnapshot } from "../../../../../workflows/start-checkout"
import { getOrCreateDefaultStockLocationId } from "../../../../../workflows/shared/default-stock-location"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const adminId = req.auth_context.actor_id
  const orders: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const order = await orders.retrieveMarketplaceOrder(req.params.id).catch(() => null)
  if (!order) { res.status(404).json({ message: "Payment not found" }); return }
  if (order.payment_status !== "proof_submitted" || !order.payment_reference || !order.payment_proof_url) {
    res.status(409).json({ message: "A submitted receipt and transaction reference are required." }); return
  }
  await orders.updateMarketplaceOrders({ id: order.id, payment_status: "under_review" })
  try {
    const locationId = await getOrCreateDefaultStockLocationId(req.scope)
    const { result } = await captureCheckoutPaymentWorkflow(req.scope).run({ input: {
      provider: "manual_telebirr", eventId: `verified:${order.id}`, eventType: "manual_payment.verified",
      orderId: order.id, customerId: order.customer_id, actorType: "user", actorId: adminId,
      reservationItemIds: (order.reservation_item_ids ?? []) as unknown as string[],
      lineItemsSnapshot: order.line_items_snapshot as unknown as CheckoutLineItemSnapshot[], locationId,
    } })
    await orders.updateMarketplaceOrders({ id: order.id, payment_reviewed_by: adminId, payment_reviewed_at: new Date() })
    res.json({ order_id: order.id, payment_status: "succeeded", claimed: result.claimed })
  } catch {
    await orders.updateMarketplaceOrders({ id: order.id, payment_status: "proof_submitted" })
    res.status(500).json({ message: "Verification could not be completed. No approval was recorded; please try again." })
  }
}
