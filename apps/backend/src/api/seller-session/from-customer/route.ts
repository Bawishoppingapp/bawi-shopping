import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"
import { issueSellerSessionToken } from "../token"

/** A signed-in Bawi customer who owns an activated seller identity can enter
 * the storefront without typing the same password a second time. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const sellers: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const auth = req.scope.resolve(Modules.AUTH)
  const identityId = req.auth_context.auth_identity_id
  const users = await sellers.listSellerUsers({ auth_identity_id: identityId })
  if (users.length !== 1) {
    res.status(404).json({ message: "No storefront is linked to this Bawi account" })
    return
  }
  const identity = await auth.retrieveAuthIdentity(identityId)
  if (identity.app_metadata?.seller_user_id !== users[0].id) {
    res.status(403).json({ message: "Seller access is not active" })
    return
  }
  res.json({ token: issueSellerSessionToken(req.scope, identity, users[0].id) })
}
