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

export interface FinanceOverviewRow {
  vendor_id: string
  vendor_name: string | null
  // The selling seller's currency (see apps/backend's Seller.currency_code).
  currency_code: string
  payouts_enabled: boolean
  balance: SellerBalance
}

export interface FinanceOverview {
  // Keyed by currency ("usd" | "etb", ...) - never one blended total, since
  // summing a USD seller's cents with an ETB seller's cents would be
  // meaningless. Only currencies with at least one seller present appear.
  platform_totals: Record<string, SellerBalance>
  sellers: FinanceOverviewRow[]
}

export interface Dispute {
  id: string
  order_id: string
  vendor_order_id: string | null
  stripe_dispute_id: string
  amount: number
  reason: string | null
  status: string
  resolved_at: string | null
  created_at: string
}

export interface AdminReturnRequest {
  id: string
  vendor_id: string
  customer_id: string
  vendor_order_item_id: string
  vendor_order_id: string
  order_id: string
  reason: string
  customer_comment: string | null
  status: string
  seller_response: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export async function getFinanceOverview(sessionToken: string): Promise<FinanceOverview> {
  return request("/admin/finance/overview", sessionToken)
}

export async function listDisputes(sessionToken: string): Promise<Dispute[]> {
  const data = await request("/admin/finance/disputes", sessionToken)
  return data.disputes
}

export async function listAdminReturnRequests(sessionToken: string): Promise<AdminReturnRequest[]> {
  const data = await request("/admin/finance/returns", sessionToken)
  return data.return_requests
}

export async function triggerPayoutBatch(
  sessionToken: string,
  vendorId: string
): Promise<{ id: string; amount: number; status: string } | null> {
  const data = await request("/admin/finance/payouts", sessionToken, {
    method: "POST",
    body: JSON.stringify({ vendor_id: vendorId }),
  })
  return data.payout
}
