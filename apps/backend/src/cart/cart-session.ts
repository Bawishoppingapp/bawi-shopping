import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { isCartExpired } from "./expiration"
import type { RawCart } from "./cart-response"

// The opaque guest cart id travels as a request header, not a cookie the
// backend itself sets - the httpOnly/secure/same-site cookie lives on the
// Next.js storefront (see apps/storefront/src/features/cart/constants.ts),
// the same pattern already used for the customer session token
// (CUSTOMER_SESSION_COOKIE forwarded as an Authorization bearer). This
// keeps the Medusa backend a pure API with no cookie-parsing dependency.
export const CART_ID_HEADER = "x-cart-id"

const LINE_ITEM_RELATIONS = ["items"]

/**
 * Finds the caller's current cart without creating one - a logged-in
 * customer's cart is looked up strictly by customer_id (never trusts a
 * guest cart id once authenticated; merging happens explicitly at login,
 * see merge-guest-cart-into-customer-cart workflow), a guest's cart is
 * looked up by the opaque id it presents and must still be an actual guest
 * cart (customer_id null). An expired cart (per the configurable
 * cart_expiration_days policy) is treated as if it doesn't exist.
 */
export async function findActiveCart(
  container: MedusaContainer,
  customerId: string | undefined,
  guestCartId: string | undefined,
  expirationDays: number
): Promise<RawCart | null> {
  const cartModuleService = container.resolve(Modules.CART)

  if (customerId) {
    const carts = await cartModuleService.listCarts(
      { customer_id: customerId },
      { relations: LINE_ITEM_RELATIONS, order: { updated_at: "DESC" }, take: 1 }
    )
    const cart = carts[0]
    if (!cart || isCartExpired(new Date(cart.updated_at as unknown as string), new Date(), expirationDays)) {
      return null
    }
    return cart as unknown as RawCart
  }

  if (!guestCartId) {
    return null
  }

  const carts = await cartModuleService.listCarts(
    { id: guestCartId },
    { relations: LINE_ITEM_RELATIONS, take: 1 }
  )
  const cart = carts[0]
  if (!cart || cart.customer_id) {
    return null
  }
  if (isCartExpired(new Date(cart.updated_at as unknown as string), new Date(), expirationDays)) {
    return null
  }
  return cart as unknown as RawCart
}

/** Only called from the add-item route - every other route only ever acts
 * on a cart that already exists. `currencyCode` is the currency of the
 * item about to be added (the caller already resolved it before calling
 * this) - it only matters for a brand-new cart, which otherwise has no
 * items to derive a currency from yet (see docs/DECISIONS.md's
 * Ethiopian-market entry: a cart is single-currency, set by its first
 * item). */
export async function resolveOrCreateCart(
  container: MedusaContainer,
  customerId: string | undefined,
  guestCartId: string | undefined,
  expirationDays: number,
  currencyCode: string
): Promise<{ cart: RawCart; isNew: boolean }> {
  const existing = await findActiveCart(container, customerId, guestCartId, expirationDays)
  if (existing) {
    return { cart: existing, isNew: false }
  }

  const cartModuleService = container.resolve(Modules.CART)
  const created = await cartModuleService.createCarts({
    currency_code: currencyCode,
    customer_id: customerId,
  })
  const cart = await cartModuleService.retrieveCart(created.id, { relations: LINE_ITEM_RELATIONS })
  return { cart: cart as unknown as RawCart, isNew: true }
}
