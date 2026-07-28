import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_FINANCE_MODULE } from "../../../../modules/seller-finance"
import type SellerFinanceModuleService from "../../../../modules/seller-finance/service"

/** Admin-only. Every Stripe dispute this platform has recorded, most
 * recent first - created/updated only from the Stripe webhook, never
 * client-initiated (see apply-stripe-dispute-webhook.ts). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const sellerFinanceModuleService: SellerFinanceModuleService = req.scope.resolve(
    SELLER_FINANCE_MODULE
  )
  const disputes = await sellerFinanceModuleService.listDisputes(
    {},
    { order: { created_at: "DESC" } }
  )

  res.json({
    disputes: disputes.map((dispute) => ({
      id: dispute.id,
      order_id: dispute.order_id,
      vendor_order_id: dispute.vendor_order_id,
      stripe_dispute_id: dispute.stripe_dispute_id,
      amount: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
      resolved_at: dispute.resolved_at,
      created_at: dispute.created_at,
    })),
  })
}
