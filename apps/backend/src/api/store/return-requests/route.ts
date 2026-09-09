import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../modules/marketplace-order"
import type OrderModuleService from "../../../modules/marketplace-order/service"
import { SELLER_FINANCE_MODULE } from "../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../modules/seller-finance/service"
import { BUSINESS_CONFIG_MODULE } from "../../../modules/business-config"
import type BusinessConfigModuleService from "../../../modules/business-config/service"
import { createReturnRequestSchema } from "../../../finance/schemas"
import { shapeReturnRequestForCustomer } from "../../../finance/return-request-response"
import { createReturnRequestWorkflow } from "../../../workflows/create-return-request"

/** A customer's own return requests. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id
  const sellerFinanceModuleService: SellerFinanceModuleService = req.scope.resolve(
    SELLER_FINANCE_MODULE
  )
  const returnRequests = await sellerFinanceModuleService.listReturnRequests(
    { customer_id: customerId },
    { order: { created_at: "DESC" } }
  )

  res.json({ return_requests: returnRequests.map(shapeReturnRequestForCustomer) })
}

/**
 * Only valid while the item's vendor_order is "delivered" and still
 * within the business-config `returns.return_window_days` window, and
 * only once per item (no second request while one is already in flight or
 * already refunded) - all checked here, not trusted from the client (see
 * create-return-request.ts).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id

  const parsed = createReturnRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" })
    return
  }

  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const vendorOrderItem = await orderModuleService
    .retrieveVendorOrderItem(parsed.data.vendor_order_item_id)
    .catch(() => null)
  if (!vendorOrderItem) {
    res.status(404).json({ message: "Order item not found" })
    return
  }
  const vendorOrder = await orderModuleService.retrieveVendorOrder(vendorOrderItem.vendor_order_id)
  const order = await orderModuleService.retrieveMarketplaceOrder(vendorOrder.order_id)
  if (order.customer_id !== customerId) {
    res.status(404).json({ message: "Order item not found" })
    return
  }

  if (vendorOrder.status !== "delivered" || !vendorOrder.delivered_at) {
    res.status(422).json({ message: "This item has not been delivered yet" })
    return
  }

  const businessConfigModuleService: BusinessConfigModuleService = req.scope.resolve(
    BUSINESS_CONFIG_MODULE
  )
  const returnsConfig = await businessConfigModuleService.getCategoryValues("returns")
  const returnWindowDays = Number(returnsConfig.return_window_days ?? 14)
  if (!Number.isFinite(returnWindowDays) || returnWindowDays <= 0) {
    res.status(422).json({ message: "Returns are not currently accepted" })
    return
  }
  const windowEndsAt =
    new Date(vendorOrder.delivered_at).getTime() + returnWindowDays * 24 * 60 * 60 * 1000
  if (Date.now() > windowEndsAt) {
    res.status(422).json({ message: "The return window for this item has closed" })
    return
  }

  const sellerFinanceModuleService: SellerFinanceModuleService = req.scope.resolve(
    SELLER_FINANCE_MODULE
  )
  const existing = await sellerFinanceModuleService.listReturnRequests({
    vendor_order_item_id: vendorOrderItem.id,
    status: ["requested", "approved", "refunded"],
  })
  if (existing.length) {
    res.status(422).json({ message: "A return request already exists for this item" })
    return
  }

  const { result: returnRequest } = await createReturnRequestWorkflow(req.scope).run({
    input: {
      vendorOrderItemId: vendorOrderItem.id,
      vendorOrderId: vendorOrder.id,
      vendorId: vendorOrder.vendor_id,
      orderId: order.id,
      customerId,
      reason: parsed.data.reason,
      customerComment: parsed.data.customer_comment ?? null,
    },
  })

  res.status(201).json({ return_request: shapeReturnRequestForCustomer(returnRequest) })
}
