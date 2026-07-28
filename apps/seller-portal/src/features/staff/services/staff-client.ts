import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class StaffClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StaffClientError"
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
    throw new StaffClientError(data.message || "Request failed")
  }
  return data
}

export interface StaffMember {
  id: string
  email: string
  role: string
  activated: boolean
}

export async function listStaff(sessionToken: string): Promise<StaffMember[]> {
  const data = await request("/seller/staff", sessionToken)
  return data.staff
}

export async function inviteStaff(
  sessionToken: string,
  email: string,
  role: string
): Promise<StaffMember> {
  const data = await request("/seller/staff", sessionToken, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  })
  return data.staff
}

export async function removeStaff(sessionToken: string, staffId: string): Promise<void> {
  await request(`/seller/staff/${staffId}`, sessionToken, { method: "DELETE" })
}
