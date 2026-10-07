import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../../modules/marketplace-order/service"
import { BUSINESS_CONFIG_MODULE } from "../../../../../modules/business-config"
import type BusinessConfigModuleService from "../../../../../modules/business-config/service"
import { cancelVendorOrderWorkflow } from "../../../../../workflows/cancel-vendor-order"

/**
 * A customer cancels one seller's portion of their order, while it's still
 * within the business-config `cancellation.cancellation_cutoff` window
 * (currently `picked_up`, so awaiting/preparing/ready-for-pickup are allowed,
 * see docs/PAYMENTS.md). Ownership is re-derived from the vendor_order's
 * parent marketplace order's own `customer_id`, never trusted from the
 * request.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id

  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const vendorOrder = await orderModuleService.retrieveVendorOrder(req.params.id).catch(() => null)
  if (!vendorOrder) {
    res.status(404).json({ message: "Order not found" })
    return
  }
  const order = await orderModuleService.retrieveMarketplaceOrder(vendorOrder.order_id)
  if (order.customer_id !== customerId) {
    res.status(404).json({ message: "Order not found" })
    return
  }

  const businessConfigModuleService: BusinessConfigModuleService = req.scope.resolve(
    BUSINESS_CONFIG_MODULE
  )
  const cancellationConfig = await businessConfigModuleService.getCategoryValues("cancellation")
  const cutoffStatus = String(cancellationConfig.cancellation_cutoff ?? "preparing")

  const cancellableStatuses = cutoffStatus === "picked_up"
    ? ["awaiting_preparation", "preparing", "ready_for_pickup"]
    : ["awaiting_preparation"]
  if (!cancellableStatuses.includes(vendorOrder.status)) {
    res.status(422).json({
      message: `This order can no longer be cancelled (status: "${vendorOrder.status}")`,
    })
    return
  }

  const { result } = await cancelVendorOrderWorkflow(req.scope).run({
    input: { vendorOrderId: vendorOrder.id, customerId },
  })

  res.json({
    vendor_order_id: vendorOrder.id,
    status: "cancelled",
    refund: { amount: result.amount, status: result.status },
  })
}
