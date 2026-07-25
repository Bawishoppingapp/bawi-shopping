import type { MedusaStoreRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CART_ID_HEADER, findActiveCart } from "../../../cart/cart-session"
import { refreshAndShapeCart, emptyPublicCart, type RawCart } from "../../../cart/cart-response"
import { clearCartWorkflow } from "../../../workflows/clear-cart"
import { BUSINESS_CONFIG_MODULE } from "../../../modules/business-config"
import type BusinessConfigModuleService from "../../../modules/business-config/service"

function guestCartId(req: MedusaStoreRequest): string | undefined {
  const header = req.headers[CART_ID_HEADER]
  return typeof header === "string" && header.length ? header : undefined
}

async function resolveExpirationDays(req: MedusaStoreRequest): Promise<number> {
  const businessConfigModuleService: BusinessConfigModuleService = req.scope.resolve(
    BUSINESS_CONFIG_MODULE
  )
  const cartConfig = await businessConfigModuleService.getCategoryValues("cart")
  return Number(cartConfig.cart_expiration_days ?? 30)
}

/**
 * Read-only - never creates a cart (only POST /store/cart/items does, see
 * docs/DECISIONS.md). Returns an empty-cart shape rather than 404 so the
 * storefront has one shape to render regardless of whether anything has
 * been added yet.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context?.actor_id
  const expirationDays = await resolveExpirationDays(req)

  const cart = await findActiveCart(req.scope, customerId, guestCartId(req), expirationDays)
  if (!cart) {
    res.json({ cart: emptyPublicCart() })
    return
  }

  res.json({ cart: await refreshAndShapeCart(req.scope, cart) })
}

/** Clears the cart (removes every line item) - the cart row itself is kept,
 * not deleted, so the same guest/customer identity continues to resolve to
 * it on the next add. */
export async function DELETE(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context?.actor_id
  const expirationDays = await resolveExpirationDays(req)

  const cart = await findActiveCart(req.scope, customerId, guestCartId(req), expirationDays)
  if (!cart) {
    res.json({ cart: emptyPublicCart() })
    return
  }

  const itemIds = cart.items.map((item) => item.id)
  await clearCartWorkflow(req.scope).run({ input: { lineItemIds: itemIds } })

  const cartModuleService = req.scope.resolve(Modules.CART)
  const refreshed = await cartModuleService.retrieveCart(cart.id, { relations: ["items"] })
  res.json({ cart: await refreshAndShapeCart(req.scope, refreshed as unknown as RawCart) })
}
