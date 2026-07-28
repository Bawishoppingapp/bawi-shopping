import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../modules/marketplace-order"
import type OrderModuleService from "../../../modules/marketplace-order/service"

/**
 * Admin-wide fulfillment view, primarily for courier assignment - unlike
 * the seller's own scoped view, Admin is permitted to see vendor_id (see
 * docs/USER-ROLES.md permission matrix), but this route still never
 * exposes the parent order's customer PII directly - only what's needed
 * to decide/perform an assignment.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined

  const vendorOrders = await orderModuleService.listVendorOrders(
    statusFilter ? { status: statusFilter } : {},
    { order: { created_at: "DESC" }, take: 100 }
  )

  res.json({
    fulfillment_orders: vendorOrders.map((vendorOrder) => ({
      id: vendorOrder.id,
      vendor_id: vendorOrder.vendor_id,
      status: vendorOrder.status,
      fulfillment_code: vendorOrder.fulfillment_code,
      fulfillment_deadline_at: vendorOrder.fulfillment_deadline_at,
      assigned_courier_id: vendorOrder.assigned_courier_id,
      ready_for_pickup_at: vendorOrder.ready_for_pickup_at,
    })),
  })
}
