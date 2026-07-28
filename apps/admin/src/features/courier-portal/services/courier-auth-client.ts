import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class CourierAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CourierAuthError"
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

export async function loginCourier(email: string, password: string): Promise<string> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/auth/courier/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new CourierAuthError(data.message || "Invalid email or password")
  }
  return data.token as string
}

export async function completeCourierActivation(token: string, password: string): Promise<void> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/courier-activation/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new CourierAuthError(data.message || "Could not activate account")
  }
}

export interface CourierMe {
  id: string
  name: string
}

export async function getCurrentCourier(sessionToken: string): Promise<CourierMe | null> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/courier/me`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })
  if (!response.ok) {
    return null
  }
  const data = await parseJson(response)
  return data.courier as CourierMe | null
}
