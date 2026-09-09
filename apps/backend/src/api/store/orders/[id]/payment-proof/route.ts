import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { MARKETPLACE_ORDER_MODULE } from "../../../../../modules/marketplace-order"
import type OrderModuleService from "../../../../../modules/marketplace-order/service"
import { AUDIT_LOG_MODULE } from "../../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../../modules/audit-log/service"

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"])
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._/-]{5,79}$/

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id
  const orders: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const order = await orders.retrieveMarketplaceOrder(req.params.id).catch(() => null)
  if (!order || order.customer_id !== customerId) {
    res.status(404).json({ message: "Order not found" })
    return
  }
  if (order.status !== "pending_payment" || !["pending", "rejected"].includes(order.payment_status)) {
    res.status(409).json({ message: "This order cannot accept another payment receipt." })
    return
  }

  const reference = String((req.body as Record<string, unknown> | undefined)?.transaction_reference ?? "").trim().toUpperCase()
  const file = req.file as Express.Multer.File | undefined
  if (!REFERENCE.test(reference)) {
    res.status(400).json({ message: "Enter a valid Telebirr transaction reference." })
    return
  }
  if (!file || !ALLOWED.has(file.mimetype) || file.size > MAX_BYTES) {
    res.status(400).json({ message: "Upload one JPEG, PNG, or WebP receipt up to 5 MB." })
    return
  }
  const duplicate = await orders.listMarketplaceOrders({ payment_reference: reference })
  if (duplicate.some((candidate) => candidate.id !== order.id)) {
    res.status(409).json({ message: "This transaction reference has already been submitted." })
    return
  }

  const { result } = await uploadFilesWorkflow(req.scope).run({
    input: { files: [{ filename: file.originalname, mimeType: file.mimetype, content: file.buffer.toString("base64"), access: "private" as const }] },
  })
  const updated = await orders.updateMarketplaceOrders({
    id: order.id,
    payment_reference: reference,
    payment_proof_url: result[0].url,
    payment_status: "proof_submitted",
    payment_submitted_at: new Date(),
    payment_rejection_reason: null,
  })
  const audit: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  await audit.record({ actorType: "customer", actorId: customerId, action: "payment.proof_submitted", entityType: "order", entityId: order.id, afterState: { payment_status: "proof_submitted", payment_reference: reference } })
  res.status(201).json({ order_id: updated.id, payment_status: updated.payment_status })
}
