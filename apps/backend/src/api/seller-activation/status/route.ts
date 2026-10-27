import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"

/** The single-use link itself authorizes this lookup; never expose the email. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = req.body as { token?: unknown }
  const token = typeof body?.token === "string" ? body.token.trim() : ""
  if (!token) {
    res.status(400).json({ message: "Activation link is required" })
    return
  }

  const sellers: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const [sellerUser] = await sellers.listSellerUsers({ activation_token: token })
  if (!sellerUser || sellerUser.auth_identity_id || !sellerUser.activation_token_expires_at || sellerUser.activation_token_expires_at.getTime() < Date.now()) {
    res.status(400).json({ message: "This activation link is invalid, expired, or already used" })
    return
  }

  const auth = req.scope.resolve(Modules.AUTH)
  const identities = await auth.listProviderIdentities({
    provider: "emailpass",
    entity_id: sellerUser.email,
  })
  res.json({ existing_account: identities.length > 0 })
}
