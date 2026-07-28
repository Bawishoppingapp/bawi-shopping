import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../modules/marketplace-order/service"
import { shapeVendorOrderForCourier } from "../../../../fulfillment/courier-assignment-response"
import { AUDIT_LOG_MODULE } from "../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../modules/audit-log/service"

/**
 * A courier reading one assignment's detail is itself audited
 * ("Audit logs for sensitive access" - docs/SECURITY.md §11), separate
 * from the status-change audit entries each action route records.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const courierId = req.auth_context.actor_id
  if (!courierId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const vendorOrder = await orderModuleService.retrieveVendorOrder(req.params.id).catch(() => null)
  if (!vendorOrder || vendorOrder.assigned_courier_id !== courierId) {
    res.status(404).json({ message: "Assignment not found" })
    return
  }

  const auditLogModuleService: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  await auditLogModuleService.record({
    actorType: "courier",
    actorId: courierId,
    action: "vendor_order.assignment_viewed",
    entityType: "vendor_order",
    entityId: vendorOrder.id,
  })

  const shaped = await shapeVendorOrderForCourier(req.scope, vendorOrder.id)
  res.json({ assignment: shaped })
}
