import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"

/**
 * Returns the seller_user and vendor (seller) the *currently authenticated*
 * session/token is allowed to act as. The vendor id is never accepted from
 * the client - it is always derived server-side from req.auth_context,
 * which the `authenticate("seller_user", ...)` middleware has already
 * verified against the signed session/JWT.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const sellerModuleService: SellerModuleService = req.scope.resolve(
    SELLER_MODULE
  )

  // For the "seller_user" actor type, Medusa sets auth_context.actor_id to
  // the auth identity's app_metadata.seller_user_id (see generate-jwt-token),
  // i.e. this *is* the SellerUser row's id - not a client-supplied value.
  const sellerUserId = req.auth_context.actor_id

  if (!sellerUserId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const sellerUser = await sellerModuleService.retrieveSellerUser(
    sellerUserId,
    { relations: ["seller"] }
  )

  res.json({
    seller_user: {
      id: sellerUser.id,
      role: sellerUser.role,
    },
    seller: {
      id: sellerUser.seller.id,
      name: sellerUser.seller.name,
      slug: sellerUser.seller.slug,
      status: sellerUser.seller.status,
      currency_code: sellerUser.seller.currency_code,
      // Never the raw stripe_account_id itself - only the derived
      // connection status a seller-portal UI needs (see docs/DECISIONS.md,
      // docs/SECURITY.md §12: a Stripe account id is treated with the same
      // sensitivity as vendor_id).
      stripe: {
        connected: Boolean(sellerUser.seller.stripe_account_id),
        charges_enabled: sellerUser.seller.stripe_charges_enabled,
        payouts_enabled: sellerUser.seller.stripe_payouts_enabled,
        details_submitted: sellerUser.seller.stripe_details_submitted,
      },
    },
  })
}
