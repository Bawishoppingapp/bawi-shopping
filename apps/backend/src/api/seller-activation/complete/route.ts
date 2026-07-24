import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"
import { completeActivationSchema } from "../../../modules/seller-application/schemas"

/**
 * Public, but gated entirely on possession of a valid, unexpired,
 * unconsumed activation_token (issued only by the approve route, never
 * guessable - see docs/MARKETPLACE-FLOWS.md). Lets a newly-approved seller
 * set their own password and log in, without an email/notification service
 * existing yet (see docs/DECISIONS.md for that deferral).
 */
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
    activation_token: parsed.data.token,
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

  const { success, error, authIdentity } = await authModuleService.register(
    "emailpass",
    { body: { email: sellerUser.email, password: parsed.data.password } }
  )

  if (!success || !authIdentity) {
    res.status(400).json({ message: error || "Could not activate account" })
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
    app_metadata: { seller_user_id: sellerUser.id },
  })

  res.json({ success: true })
}
