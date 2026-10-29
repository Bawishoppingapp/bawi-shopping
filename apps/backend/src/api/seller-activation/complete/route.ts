import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"
import { completeActivationSchema } from "../../../modules/seller-application/schemas"
import { normalizeActivationToken } from "../../../modules/seller-application/utils"

/** A valid approval link and the email's existing password (when one exists)
 * are both required before granting seller access to an existing identity. */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const parsed = completeActivationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const authModuleService = req.scope.resolve(Modules.AUTH)

  const [sellerUser] = await sellerModuleService.listSellerUsers({
    activation_token: normalizeActivationToken(parsed.data.token),
  })

  if (!sellerUser) {
    res.status(400).json({ message: "Invalid or already-used activation link" })
    return
  }

  if (sellerUser.auth_identity_id) {
    res.status(400).json({ message: "This account has already been activated" })
    return
  }

  if (
    !sellerUser.activation_token_expires_at ||
    sellerUser.activation_token_expires_at.getTime() < Date.now()
  ) {
    res.status(400).json({ message: "This activation link has expired" })
    return
  }

  const existing = await authModuleService.listProviderIdentities({
    provider: "emailpass",
    entity_id: sellerUser.email,
  })
  if (!existing.length && (parsed.data.password.length < 8 || !/[a-z]/.test(parsed.data.password) || !/[A-Z]/.test(parsed.data.password) || !/[0-9]/.test(parsed.data.password))) {
    res.status(400).json({ message: "Use at least 8 characters with uppercase, lowercase and a number" })
    return
  }
  const { success, error, authIdentity, mfaChallenge } = existing.length
    ? await authModuleService.authenticate("emailpass", {
        body: { email: sellerUser.email, password: parsed.data.password },
      })
    : await authModuleService.register("emailpass", {
        body: { email: sellerUser.email, password: parsed.data.password },
      })

  if (!success || !authIdentity || mfaChallenge) {
    res.status(400).json({
      message: existing.length
        ? "Use the password for your existing Bawi account to activate your storefront."
        : error || "Could not activate account",
    })
    return
  }

  if (authIdentity.app_metadata?.seller_user_id && authIdentity.app_metadata.seller_user_id !== sellerUser.id) {
    res.status(409).json({ message: "This Bawi login is already linked to another storefront" })
    return
  }

  await sellerModuleService.updateSellerUsers({
    id: sellerUser.id,
    auth_identity_id: authIdentity.id,
    activation_token: null,
    activation_token_expires_at: null,
  })

  await authModuleService.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { ...authIdentity.app_metadata, seller_user_id: sellerUser.id },
  })

  res.json({ success: true })
}
