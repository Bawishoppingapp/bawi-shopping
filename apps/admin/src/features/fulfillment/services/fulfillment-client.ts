import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class FulfillmentClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FulfillmentClientError"
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

export interface AdminFulfillmentOrder {
  id: string
  vendor_id: string
  status: string
  fulfillment_code: string
  fulfillment_deadline_at: string
  assigned_courier_id: string | null
  ready_for_pickup_at: string | null
}

export async function listFulfillmentOrders(
  sessionToken: string,
  status?: string
): Promise<AdminFulfillmentOrder[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/fulfillment-orders${query}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })
  if (!response.ok) {
    return []
  }
  const data = await response.json()
  return data.fulfillment_orders as AdminFulfillmentOrder[]
}

export async function assignCourier(
  sessionToken: string,
  fulfillmentOrderId: string,
  courierId: string
): Promise<void> {
  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/admin/fulfillment-orders/${fulfillmentOrderId}/assign-courier`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ courier_id: courierId }),
      cache: "no-store",
    }
  )
  const data = await parseJson(response)
  if (!response.ok) {
    throw new FulfillmentClientError(data.message || "Could not assign courier")
  }
}
