import "server-only"

const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class MedusaAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MedusaAuthError"
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
 * Server-only wrapper around Medusa's native `user` (admin) auth endpoints.
 * Every call happens on the server; the admin app never receives more than
 * the HTTP-only session cookie the calling Server Action sets afterward.
 */
export async function loginAdminUser(
  email: string,
  password: string
): Promise<string> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  const data = await parseJson(response)

  if (!response.ok) {
    throw new MedusaAuthError(data.message || "Invalid email or password")
  }

  return data.token as string
}

export interface AdminMe {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

/**
 * Resolves the currently authenticated admin from the session token via
 * Medusa's native GET /admin/users/me - never trusts anything the client
 * sends about who it claims to be.
 */
export async function getCurrentAdmin(sessionToken: string): Promise<AdminMe | null> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/users/me`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const data = await parseJson(response)
  return data.user as AdminMe | null
}
