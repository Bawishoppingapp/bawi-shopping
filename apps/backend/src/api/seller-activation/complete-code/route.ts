import { randomBytes } from "node:crypto"
import type { AuthContext, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"
import { normalizeActivationToken } from "../../../modules/seller-application/utils"
import { issueSellerSessionToken } from "../../seller-session/token"

/** Exchange the emailed, single-use code for a seller session. The code is
 * 60 random bits for new invitations, rate-limited and valid for seven days. */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = req.body as { code?: unknown }
  const code = typeof body?.code === "string" ? normalizeActivationToken(body.code) : ""
  if (!code) {
    res.status(400).json({ message: "Enter the activation code from your email" })
    return
  }
  const sellers: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const auth = req.scope.resolve(Modules.AUTH)
  const [sellerUser] = await sellers.listSellerUsers({ activation_token: code })
  if (!sellerUser || sellerUser.auth_identity_id || !sellerUser.activation_token_expires_at || sellerUser.activation_token_expires_at.getTime() < Date.now()) {
    res.status(400).json({ message: "This code is invalid, expired, or already used. Use the newest email." })
    return
  }

  const [provider] = await auth.listProviderIdentities({ provider: "emailpass", entity_id: sellerUser.email })
  const context = (req as MedusaRequest & { auth_context?: AuthContext }).auth_context
  const customerContext = context?.actor_type === "customer" ? context : null
  let identityId = provider?.auth_identity_id ?? customerContext?.auth_identity_id
  if (!identityId) {
    // The approval email proves control of this address. Register an identity
    // with an unguessable credential so activation never asks for a password.
    // The seller can set their own password later through password reset.
    const registration = await auth.register("emailpass", {
      body: { email: sellerUser.email, password: randomBytes(32).toString("base64url") },
    })
    if (!registration.success || !registration.authIdentity || registration.mfaChallenge) {
      res.status(409).json({ message: "Could not create your Bawi login. Please try again or contact support." })
      return
    }
    identityId = registration.authIdentity.id
  }
  const identity = await auth.retrieveAuthIdentity(identityId)
  if (identity.app_metadata?.seller_user_id && identity.app_metadata.seller_user_id !== sellerUser.id) {
    res.status(409).json({ message: "This Bawi account already owns another storefront" })
    return
  }

  const updated = await auth.updateAuthIdentities({
    id: identity.id,
    app_metadata: { ...identity.app_metadata, seller_user_id: sellerUser.id },
  })
  // Consume the single-use code last. If identity linking fails, the seller
  // can retry with the same code instead of being stranded half-activated.
  await sellers.updateSellerUsers({
    id: sellerUser.id,
    auth_identity_id: identity.id,
    activation_token: null,
    activation_token_expires_at: null,
  })
  res.json({ token: issueSellerSessionToken(req.scope, updated, sellerUser.id) })
}
