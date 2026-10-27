import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_APPLICATION_MODULE } from "../../../../../modules/seller-application"
import type SellerApplicationModuleService from "../../../../../modules/seller-application/service"
import { SELLER_MODULE } from "../../../../../modules/seller"
import type SellerModuleService from "../../../../../modules/seller/service"
import { BUSINESS_CONFIG_MODULE } from "../../../../../modules/business-config"
import type BusinessConfigModuleService from "../../../../../modules/business-config/service"
import { resendSellerActivationWorkflow } from "../../../../../workflows/resend-seller-activation"

/** Issue a fresh, single-use link only for an approved, unactivated seller. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const applications: SellerApplicationModuleService = req.scope.resolve(SELLER_APPLICATION_MODULE)
  const sellers: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const config: BusinessConfigModuleService = req.scope.resolve(BUSINESS_CONFIG_MODULE)

  let application
  try {
    application = await applications.retrieveSellerApplication(req.params.id)
  } catch {
    res.status(404).json({ message: "Application not found" })
    return
  }
  if (application.status !== "approved" || !application.seller_id) {
    res.status(409).json({ message: "Only approved applications can receive an activation email" })
    return
  }

  const users = await sellers.listSellerUsers({ seller_id: application.seller_id })
  const owner = users.find((user) => user.role === "owner")
  if (!owner) {
    res.status(409).json({ message: "This seller has no owner account" })
    return
  }
  if (owner.auth_identity_id) {
    res.status(409).json({ message: "This seller account is already activated" })
    return
  }

  const emailEnabled = await config.getFeatureFlag("real_email_enabled")
  const providerConfigured = ["resend", "brevo", "sendgrid"].includes(process.env.EMAIL_PROVIDER ?? "")
  if (!emailEnabled || !providerConfigured) {
    res.status(503).json({ message: "Production email is not enabled" })
    return
  }

  try {
    await resendSellerActivationWorkflow(req.scope).run({
      input: {
        applicationId: application.id,
        sellerId: application.seller_id,
        sellerUserId: owner.id,
        email: owner.email,
        storeName: application.store_name,
      },
    })
  } catch {
    res.status(502).json({ message: "Could not send the activation email. Please try again." })
    return
  }

  res.json({ sent: true, email: owner.email })
}
