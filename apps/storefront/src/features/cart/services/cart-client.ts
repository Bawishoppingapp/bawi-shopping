import "server-only"
import { cookies } from "next/headers"
import { CART_ID_COOKIE, type Cart } from "../constants"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
const MEDUSA_PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY ?? ""

export class CartError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CartError"
  }
}

async function parseJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

/**
 * Every /store/cart* call carries the publishable API key (Medusa's own
 * /store/* middleware requires it, same as /store/customers - see
 * medusa-auth-client.ts) plus, if present, the guest cart id header or the
 * customer's bearer token. A guest never reaches this module directly -
 * only Server Components/Actions do, so the cart id cookie stays
 * httpOnly and the customer JWT never reaches client JS.
 */
async function cartRequestHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies()
  const cartId = cookieStore.get(CART_ID_COOKIE)?.value
  const customerToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
  }
  if (cartId) {
    headers["x-cart-id"] = cartId
  }
  if (customerToken) {
    headers.Authorization = `Bearer ${customerToken}`
  }
  return headers
}

async function cartRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; cart: Cart }> {
  const headers = await cartRequestHeaders()
  const response = await fetch(`${MEDUSA_BACKEND_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new CartError(data.message || "Something went wrong with your cart")
  }
  return { ok: response.ok, status: response.status, cart: data.cart as Cart }
}

export async function getCart(): Promise<Cart> {
  const { cart } = await cartRequest("GET", "/store/cart")
  return cart
}

export async function addCartItem(variantId: string, quantity: number): Promise<Cart> {
  const { cart } = await cartRequest("POST", "/store/cart/items", {
    variant_id: variantId,
    quantity,
  })
  return cart
}

export async function updateCartItemQuantity(
  lineItemId: string,
  quantity: number
): Promise<Cart> {
  const { cart } = await cartRequest("PATCH", `/store/cart/items/${lineItemId}`, { quantity })
  return cart
}

export async function removeCartItem(lineItemId: string): Promise<Cart> {
  const { cart } = await cartRequest("DELETE", `/store/cart/items/${lineItemId}`)
  return cart
}

export async function clearCart(): Promise<Cart> {
  const { cart } = await cartRequest("DELETE", "/store/cart")
  return cart
}

/**
 * Called once by the login/register Server Actions right after a customer
 * session is established - reads the guest cart cookie itself (never
 * exposed to client JS) and forwards it as the merge request's body.
 */
export async function mergeGuestCartIntoCustomerCart(customerToken: string): Promise<Cart> {
  const cookieStore = await cookies()
  const guestCartId = cookieStore.get(CART_ID_COOKIE)?.value

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/cart/merge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({ guest_cart_id: guestCartId }),
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new CartError(data.message || "Could not merge your cart")
  }
  return data.cart as Cart
}
