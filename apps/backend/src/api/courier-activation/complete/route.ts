import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { FULFILLMENT_PRIVACY_MODULE } from "../../../modules/fulfillment-privacy"
import type FulfillmentPrivacyModuleService from "../../../modules/fulfillment-privacy/service"
import { courierActivationSchema } from "../../../fulfillment/schemas"

/**
 * Public, but gated entirely on possession of a valid, unexpired,
 * unconsumed activation_token - same pattern as seller-activation/complete
 * (see docs/DECISIONS.md).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = courierActivationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = req.scope.resolve(
    FULFILLMENT_PRIVACY_MODULE
  )
  const authModuleService = req.scope.resolve(Modules.AUTH)

  const [courier] = await fulfillmentPrivacyModuleService.listCouriers({
    activation_token: parsed.data.token,
  })

  if (!courier) {
    res.status(400).json({ message: "Invalid or already-used activation link" })
    return
  }
  if (courier.auth_identity_id) {
    res.status(400).json({ message: "This account has already been activated" })
    return
  }
  if (
    !courier.activation_token_expires_at ||
    courier.activation_token_expires_at.getTime() < Date.now()
  ) {
    res.status(400).json({ message: "This activation link has expired" })
    return
  }

  const { success, error, authIdentity } = await authModuleService.register("emailpass", {
    body: { email: courier.email, password: parsed.data.password },
  })

  if (!success || !authIdentity) {
    res.status(400).json({ message: error || "Could not activate account" })
    return
  }

  await fulfillmentPrivacyModuleService.updateCouriers({
    id: courier.id,
    auth_identity_id: authIdentity.id,
    activation_token: null,
    activation_token_expires_at: null,
  })

  await authModuleService.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { courier_id: courier.id },
  })

  res.json({ success: true })
}
