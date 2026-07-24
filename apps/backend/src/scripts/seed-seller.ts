import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

/**
 * Dev/test-only provisioning script. Sellers aren't self-registered in this
 * slice (see docs/MARKETPLACE-FLOWS.md) - in production a seller_user is
 * created when a SellerApplication is approved. This script exists so the
 * seller-portal login flow has something to log into locally and in
 * integration tests, without exposing an unauthenticated "create a seller"
 * HTTP endpoint.
 *
 * Usage: npx medusa exec ./src/scripts/seed-seller.ts <name> <slug> <email> <password>
 */
export default async function seedSeller({ container, args }: ExecArgs) {
  const [
    name = "Demo Seller",
    slug = "demo-seller",
    email = "seller@example.com",
    password = "supersecret123",
  ] = args

  const sellerModuleService: SellerModuleService = container.resolve(
    SELLER_MODULE
  )
  const authModuleService = container.resolve(Modules.AUTH)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const [existing] = await sellerModuleService.listSellers({ slug })
  const seller =
    existing ??
    (await sellerModuleService.createSellers({
      name,
      slug,
      status: "approved",
    }))

  const { success, error, authIdentity } = await authModuleService.register(
    "emailpass",
    { body: { email, password } }
  )

  if (!success || !authIdentity) {
    logger.error(`Could not create auth identity for ${email}: ${error}`)
    return
  }

  const sellerUser = await sellerModuleService.createSellerUsers({
    seller_id: seller.id,
    auth_identity_id: authIdentity.id,
    role: "owner",
  })

  await authModuleService.updateAuthIdentities({
    id: authIdentity.id,
    app_metadata: { seller_user_id: sellerUser.id },
  })

  logger.info(
    `Seeded seller "${seller.name}" (${seller.id}) with seller_user ${sellerUser.id} (${email})`
  )
}
