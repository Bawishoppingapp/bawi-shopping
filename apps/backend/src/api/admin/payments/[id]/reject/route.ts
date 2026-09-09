import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { MARKETPLACE_ORDER_MODULE } from "../../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../../modules/marketplace-order/service"
import { AUDIT_LOG_MODULE } from "../../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../../modules/audit-log/service"

const schema = z.object({ reason: z.string().trim().min(3).max(500) })
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ message: parsed.error.issues[0]?.message }); return }
  const adminId = req.auth_context.actor_id
  const orders: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const order = await orders.retrieveMarketplaceOrder(req.params.id).catch(() => null)
  if (!order) { res.status(404).json({ message: "Payment not found" }); return }
  if (!['proof_submitted', 'under_review'].includes(order.payment_status)) { res.status(409).json({ message: "This payment is not awaiting review." }); return }
  await orders.updateMarketplaceOrders({ id: order.id, payment_status: "rejected", payment_rejection_reason: parsed.data.reason, payment_reviewed_by: adminId, payment_reviewed_at: new Date() })
  const audit: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  await audit.record({ actorType: "user", actorId: adminId, action: "payment.rejected", entityType: "order", entityId: order.id, beforeState: { payment_status: order.payment_status }, afterState: { payment_status: "rejected", reason: parsed.data.reason } })
  res.json({ order_id: order.id, payment_status: "rejected" })
}
