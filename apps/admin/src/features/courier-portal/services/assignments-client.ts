import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class AssignmentsClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AssignmentsClientError"
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

export interface AssignmentItem {
  title: string
  color: string | null
  size: string | null
  quantity: number
}

export interface Assignment {
  id: string
  status: string
  fulfillment_code: string
  fulfillment_deadline_at: string
  pickup_location: { name: string; address_1: string | null; city: string | null }
  items: AssignmentItem[]
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
    throw new AssignmentsClientError(data.message || "Request failed")
  }
  return data
}

export async function listAssignments(sessionToken: string): Promise<Assignment[]> {
  const data = await request("/courier/assignments", sessionToken)
  return data.assignments
}

export async function getAssignment(sessionToken: string, id: string): Promise<Assignment> {
  const data = await request(`/courier/assignments/${id}`, sessionToken)
  return data.assignment
}

export async function confirmPickup(
  sessionToken: string,
  id: string,
  code: string
): Promise<Assignment> {
  const data = await request(`/courier/assignments/${id}/confirm-pickup`, sessionToken, {
    method: "POST",
    body: JSON.stringify({ code }),
  })
  return data.assignment
}

export async function startDelivery(sessionToken: string, id: string): Promise<Assignment> {
  const data = await request(`/courier/assignments/${id}/start-delivery`, sessionToken, {
    method: "POST",
  })
  return data.assignment
}

export async function confirmDelivery(
  sessionToken: string,
  id: string,
  code: string
): Promise<Assignment> {
  const data = await request(`/courier/assignments/${id}/confirm-delivery`, sessionToken, {
    method: "POST",
    body: JSON.stringify({ code }),
  })
  return data.assignment
}
