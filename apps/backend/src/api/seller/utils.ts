import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../modules/seller"
import type SellerModuleService from "../../modules/seller/service"

/**
 * Resolves the calling seller_user's vendor (seller) id from the
 * authenticated session - never from a client-supplied field. Shared by
 * every seller-scoped product route so vendor scoping is derived the same
 * way everywhere (see docs/DECISIONS.md, docs/SECURITY.md §2).
 */
export async function resolveVendorId(
  req: AuthenticatedMedusaRequest
): Promise<string | null> {
  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const sellerUserId = req.auth_context.actor_id

  if (!sellerUserId) {
    return null
  }

  const sellerUser = await sellerModuleService.retrieveSellerUser(sellerUserId, {
    relations: ["seller"],
  })

  return sellerUser.seller.id
}
