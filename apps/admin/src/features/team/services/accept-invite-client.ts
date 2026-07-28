import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class AcceptInviteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AcceptInviteError"
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
 * Mirrors the storefront customer-registration two-step exchange
 * (register the auth identity, then finalize the entity record) - Medusa's
 * native admin-invite acceptance uses the same shape: a registration token
 * from `/auth/user/emailpass/register` is exchanged, as a bearer token,
 * for the actual `User` row via `POST /admin/invites/accept?token=...`.
 */
export async function acceptAdminInvite(input: {
  inviteToken: string
  email: string
  password: string
  firstName: string
  lastName: string
}): Promise<void> {
  const registerResponse = await fetch(`${MEDUSA_BACKEND_URL}/auth/user/emailpass/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: input.email, password: input.password }),
  })
  const registerData = await parseJson(registerResponse)
  if (!registerResponse.ok) {
    throw new AcceptInviteError(registerData.message || "Could not create your account")
  }
  const registrationToken = registerData.token as string

  const acceptResponse = await fetch(
    `${MEDUSA_BACKEND_URL}/admin/invites/accept?token=${encodeURIComponent(input.inviteToken)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${registrationToken}`,
      },
      body: JSON.stringify({
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
      }),
    }
  )
  const acceptData = await parseJson(acceptResponse)
  if (!acceptResponse.ok) {
    throw new AcceptInviteError(acceptData.message || "This invite is invalid or has expired")
  }
}
