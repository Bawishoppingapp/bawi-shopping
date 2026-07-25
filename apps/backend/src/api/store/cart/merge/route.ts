import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { mergeCartSchema } from "../../../../cart/schemas"
import { mergeGuestCartIntoCustomerCart } from "../../../../cart/merge-guest-cart"
import { refreshAndShapeCart, emptyPublicCart, type RawCart } from "../../../../cart/cart-response"

/**
 * Called once by the storefront's login/register Server Action right after
 * a customer session is established - never by client JS directly (the
 * guest cart id lives in an httpOnly cookie only the Server Action can
 * read). Requires an authenticated customer; the vendor/customer identity
 * split is irrelevant here (a cart never carries customer PII to a
 * seller), but customer_id itself is always derived from the verified
 * session, never accepted as input.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const parsed = mergeCartSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, parsed.error.issues[0]?.message ?? "Invalid input")
  }

  const customerId = req.auth_context.actor_id
  const cartId = await mergeGuestCartIntoCustomerCart(
    req.scope,
    customerId,
    parsed.data.guest_cart_id
  )

  if (!cartId) {
    res.json({ cart: emptyPublicCart() })
    return
  }

  const cartModuleService = req.scope.resolve(Modules.CART)
  const cart = await cartModuleService.retrieveCart(cartId, { relations: ["items"] })
  res.json({ cart: await refreshAndShapeCart(req.scope, cart as unknown as RawCart) })
}
