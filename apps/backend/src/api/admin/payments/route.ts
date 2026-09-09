import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../modules/marketplace-order"
import type OrderModuleService from "../../../modules/marketplace-order/service"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const orders: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const status = typeof req.query.status === "string" ? req.query.status : undefined
  const rows = await orders.listMarketplaceOrders(status ? { payment_status: status } : {}, { order: { created_at: "DESC" } })
  res.json({ payments: rows.map((o) => ({ id: o.id, display_id: o.display_id, customer_id: o.customer_id, currency_code: o.currency_code, subtotal: o.subtotal_amount, shipping: o.shipping_amount, tax: o.tax_amount, total: o.total_amount, payment_method: o.payment_method, payment_status: o.payment_status, transaction_reference: o.payment_reference, proof_url: o.payment_proof_url, submitted_at: o.payment_submitted_at, reviewed_at: o.payment_reviewed_at, rejection_reason: o.payment_rejection_reason, created_at: o.created_at })) })
}
