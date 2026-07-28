import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class CouriersClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CouriersClientError"
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

export interface CourierSummary {
  id: string
  name: string
  email: string
  status: string
  activated: boolean
}

export async function listCouriers(sessionToken: string): Promise<CourierSummary[]> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/couriers`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })
  if (!response.ok) {
    return []
  }
  const data = await response.json()
  return data.couriers as CourierSummary[]
}

export async function createCourier(
  sessionToken: string,
  input: { name: string; email: string; phone?: string }
): Promise<{ courier: { id: string; name: string; email: string }; activation_url: string }> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/couriers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new CouriersClientError(data.message || "Could not create courier")
  }
  return data
}
