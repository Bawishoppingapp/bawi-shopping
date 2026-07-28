import "server-only"
import { cookies } from "next/headers"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
const MEDUSA_PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY ?? ""

export class ReturnsClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ReturnsClientError"
  }
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const cookieStore = await cookies()
  const customerToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  if (!customerToken) {
    return null
  }
  return {
    "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    Authorization: `Bearer ${customerToken}`,
    "Content-Type": "application/json",
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

export async function cancelVendorOrder(vendorOrderId: string): Promise<void> {
  const headers = await authHeaders()
  if (!headers) {
    throw new ReturnsClientError("Not authenticated")
  }
  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/vendor-orders/${vendorOrderId}/cancel`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
    cache: "no-store",
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new ReturnsClientError(data.message || "Could not cancel this order")
  }
}

export async function createReturnRequest(input: {
  vendorOrderItemId: string
  reason: "damaged" | "defective" | "incorrect" | "customer_remorse"
  customerComment: string | null
}): Promise<void> {
  const headers = await authHeaders()
  if (!headers) {
    throw new ReturnsClientError("Not authenticated")
  }
  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/return-requests`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      vendor_order_item_id: input.vendorOrderItemId,
      reason: input.reason,
      customer_comment: input.customerComment,
    }),
    cache: "no-store",
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new ReturnsClientError(data.message || "Could not submit this return request")
  }
}
