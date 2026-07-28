import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class TeamClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TeamClientError"
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
    throw new TeamClientError(data.message || "Request failed")
  }
  return data
}

export interface AdminUserSummary {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
}

export interface AdminInvite {
  id: string
  email: string
  accepted: boolean
  expires_at: string
  token: string
}

export async function listAdminUsers(sessionToken: string): Promise<AdminUserSummary[]> {
  const data = await request("/admin/users", sessionToken)
  return data.users
}

export async function listAdminInvites(sessionToken: string): Promise<AdminInvite[]> {
  const data = await request("/admin/invites", sessionToken)
  return data.invites
}

export async function createAdminInvite(
  sessionToken: string,
  email: string
): Promise<AdminInvite> {
  const data = await request("/admin/invites", sessionToken, {
    method: "POST",
    body: JSON.stringify({ email }),
  })
  return data.invite
}

export async function deleteAdminInvite(sessionToken: string, inviteId: string): Promise<void> {
  await request(`/admin/invites/${inviteId}`, sessionToken, { method: "DELETE" })
}

export async function deleteAdminUser(sessionToken: string, userId: string): Promise<void> {
  await request(`/admin/users/${userId}`, sessionToken, { method: "DELETE" })
}
