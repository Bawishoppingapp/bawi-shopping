import "server-only"

const BACKEND = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export interface ManualPayment {
  id: string
  display_id: string
  customer_id: string
  currency_code: string
  subtotal: number
  shipping: number
  tax: number
  total: number
  payment_method: string
  payment_status: string
  transaction_reference: string | null
  proof_url: string | null
  submitted_at: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}

async function parse(response: Response) {
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) throw new Error(data.message ?? "Payment request failed")
  return data
}

export async function listPayments(token: string, status?: string): Promise<ManualPayment[]> {
  const url = new URL(`${BACKEND}/admin/payments`)
  if (status) url.searchParams.set("status", status)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
  return (await parse(response)).payments
}

export async function approvePayment(token: string, id: string): Promise<void> {
  await parse(await fetch(`${BACKEND}/admin/payments/${id}/approve`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }))
}

export async function rejectPayment(token: string, id: string, reason: string): Promise<void> {
  await parse(await fetch(`${BACKEND}/admin/payments/${id}/reject`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }))
}
