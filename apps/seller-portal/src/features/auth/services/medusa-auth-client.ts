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
 * Server-only wrapper around Medusa's seller_user auth endpoints. Every
 * call happens on the server; the seller portal never receives more than
 * the HTTP-only session cookie the calling Server Action sets afterward.
 */
export async function loginSellerUser(
  email: string,
  password: string
): Promise<string> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/auth/seller_user/emailpass`, {
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

export async function completeSellerActivation(
  token: string,
  password: string
): Promise<void> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller-activation/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  })

  const data = await parseJson(response)

  if (!response.ok) {
    throw new MedusaAuthError(data.message || "Could not activate account")
  }
}

export interface SellerMe {
  seller_user: { id: string; role: string }
  seller: {
    id: string
    name: string
    slug: string
    status: string
    stripe: {
      connected: boolean
      charges_enabled: boolean
      payouts_enabled: boolean
      details_submitted: boolean
    }
  }
}

/**
 * Resolves the vendor the caller's session is allowed to act as. The
 * vendor id always comes from this server-side call - never from
 * anything the client sends - so a seller can only ever see their own
 * seller/vendor record (see apps/backend's GET /seller/me route).
 */
export async function getCurrentSeller(
  sessionToken: string
): Promise<SellerMe | null> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller/me`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  return (await parseJson(response)) as SellerMe
}
