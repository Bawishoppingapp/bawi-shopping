import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class FinanceClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FinanceClientError"
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

async function request(path: string, sessionToken: string, init?: RequestInit) {
  const response = await fetch(`${MEDUSA_BACKEND_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new FinanceClientError(data.message || "Request failed")
  }
  return data
}

export interface SellerBalance {
  pending: number
  available: number
  paid: number
  disputed: number
  reversed: number
}

export interface Payout {
  id: string
  amount: number
  status: string
  payment_provider_reference?: string | null
  created_at: string
}

export interface ReturnRequest {
  id: string
  vendor_order_item_id: string
  vendor_order_id: string
  order_id: string
  reason: string
  customer_comment: string | null
  status: string
  seller_response: string | null
  reviewed_at: string | null
  created_at: string
}

export async function getBalance(sessionToken: string): Promise<SellerBalance> {
  const data = await request("/seller/finance/balance", sessionToken)
  return data.balance
}

export async function listPayouts(sessionToken: string): Promise<Payout[]> {
  const data = await request("/seller/finance/payouts", sessionToken)
  return data.payouts
}

export async function listReturnRequests(sessionToken: string): Promise<ReturnRequest[]> {
  const data = await request("/seller/returns", sessionToken)
  return data.return_requests
}

export async function getReturnRequest(sessionToken: string, id: string): Promise<ReturnRequest> {
  const data = await request(`/seller/returns/${id}`, sessionToken)
  return data.return_request
}

export async function approveReturnRequest(
  sessionToken: string,
  id: string,
  requestedAmount?: number
): Promise<ReturnRequest> {
  const data = await request(`/seller/returns/${id}/approve`, sessionToken, {
    method: "POST",
    body: JSON.stringify(requestedAmount ? { requested_amount: requestedAmount } : {}),
  })
  return data.return_request
}

export async function denyReturnRequest(
  sessionToken: string,
  id: string,
  sellerResponse: string
): Promise<ReturnRequest> {
  const data = await request(`/seller/returns/${id}/deny`, sessionToken, {
    method: "POST",
    body: JSON.stringify({ seller_response: sellerResponse }),
  })
  return data.return_request
}
