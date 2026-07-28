import "server-only"
import { cookies } from "next/headers"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"
import type { ShippingAddress, CheckoutStartResult } from "../constants"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
const MEDUSA_PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY ?? ""

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CheckoutError"
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
 * Checkout always requires an authenticated customer (no guest checkout -
 * see docs/DATABASE.md, order.customer_id is NOT NULL by design) - the
 * customer's session JWT is forwarded the same way cart-client.ts does it,
 * never exposed to client JS.
 */
export async function startCheckout(
  shippingAddress: ShippingAddress,
  idempotencyKey: string
): Promise<CheckoutStartResult> {
  const cookieStore = await cookies()
  const customerToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  if (!customerToken) {
    throw new CheckoutError("You must be signed in to check out.")
  }

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      shipping_address: shippingAddress,
      idempotency_key: idempotencyKey,
    }),
    cache: "no-store",
  })

  const data = await parseJson(response)
  if (!response.ok) {
    throw new CheckoutError(data.message || "Could not start checkout")
  }
  return data as CheckoutStartResult
}
