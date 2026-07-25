import { cookies } from "next/headers"
import { CART_ID_COOKIE } from "../constants"
import { mergeGuestCartIntoCustomerCart } from "../services/cart-client"

/**
 * Called by the login and register Server Actions right after a customer
 * session cookie is set - never by client JS, and never exposed as its own
 * route. Failure here must not block login/registration itself (a stuck
 * guest cart is recoverable; a customer unable to sign in is not), so
 * callers should treat this as best-effort.
 */
export async function mergeGuestCartOnLogin(customerToken: string): Promise<void> {
  await mergeGuestCartIntoCustomerCart(customerToken)

  const cookieStore = await cookies()
  cookieStore.delete(CART_ID_COOKIE)
}
