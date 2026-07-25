import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"
import { connectSellerStripeAccountWorkflow } from "../../../../workflows/connect-seller-stripe-account"

const SELLER_PORTAL_URL = process.env.SELLER_PORTAL_URL ?? "http://localhost:3001"

/**
 * Seller-authenticated (see middlewares.ts). Creates the seller's Stripe
 * Express account if one doesn't exist yet, and returns a single-use,
 * short-lived Account Link URL for the seller portal to redirect to. The
 * vendor id always comes from the authenticated session (GET /seller/me's
 * resolution pattern), never a client-supplied value.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)

  const sellerUserId = req.auth_context.actor_id
  const sellerUser = await sellerModuleService.retrieveSellerUser(sellerUserId, {
    relations: ["seller"],
  })

  const { result } = await connectSellerStripeAccountWorkflow(req.scope).run({
    input: {
      sellerId: sellerUser.seller.id,
      existingStripeAccountId: sellerUser.seller.stripe_account_id,
      sellerUserId,
      returnUrl: `${SELLER_PORTAL_URL}/dashboard?stripe=return`,
      refreshUrl: `${SELLER_PORTAL_URL}/dashboard?stripe=refresh`,
    },
  })

  res.json({ url: result.url })
}
