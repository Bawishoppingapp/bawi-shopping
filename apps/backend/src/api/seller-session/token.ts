import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, generateJwtToken } from "@medusajs/framework/utils"

/** Issue the same actor-scoped JWT shape used by Medusa's emailpass route. */
export function issueSellerSessionToken(
  scope: MedusaContainer,
  identity: { id: string; app_metadata?: Record<string, unknown> },
  sellerUserId: string
): string {
  const { http } = scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig
  const appMetadata = { ...identity.app_metadata, seller_user_id: sellerUserId }
  return generateJwtToken({
    actor_id: sellerUserId,
    actor_type: "seller_user",
    auth_identity_id: identity.id,
    auth_provider: "emailpass",
    app_metadata: appMetadata,
    user_metadata: {},
  }, {
    secret: http.jwtSecret,
    expiresIn: http.jwtExpiresIn,
    jwtOptions: http.jwtOptions,
  })
}
