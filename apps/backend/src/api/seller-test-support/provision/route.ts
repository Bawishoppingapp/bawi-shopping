import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"

/**
 * TEST-ONLY. Lets the integration test suite provision a seller + seller_user
 * against a real running server without an unauthenticated "create a seller"
 * endpoint existing anywhere else. Gated on ENABLE_TEST_SUPPORT_ROUTES rather
 * than NODE_ENV because `medusa develop` forces NODE_ENV=development itself.
 * Mirrors src/scripts/seed-seller.ts.
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  if (process.env.ENABLE_TEST_SUPPORT_ROUTES !== "true") {
    res.status(404).json({ message: "Not found" })
    return
  }

  const { name, slug, email, password } = req.body as Record<string, string>

  const sellerModuleService: SellerModuleService = req.scope.resolve(
    SELLER_MODULE
  )
  const authModuleService = req.scope.resolve(Modules.AUTH)

  const seller = await sellerModuleService.createSellers({
    name,
    slug,
    status: "approved",
  })

  const { success, error, authIdentity } = await authModuleService.register(
    "emailpass",
    { body: { email, password } }
  )

  if (!success || !authIdentity) {
    res.status(400).json({ message: error || "Could not create auth identity" })
    return
  }

  const sellerUser = await sellerModuleService.createSellerUsers({
    seller_id: seller.id,
    email,
    auth_identity_id: authIdentity.id,
    role: "owner",
  })

  await authModuleService.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { seller_user_id: sellerUser.id },
  })

  res.json({ seller, seller_user: sellerUser })
}
