import "server-only"
import { cookies } from "next/headers"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
const MEDUSA_PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY ?? ""

export interface NotificationEntry {
  id: string
  event_type: string
  subject: string
  body: string
  read_at: string | null
  created_at: string
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const cookieStore = await cookies()
  const customerToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  if (!customerToken) {
    return null
  }
  return {
    "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    Authorization: `Bearer ${customerToken}`,
  }
}

export async function listNotifications(): Promise<NotificationEntry[]> {
  const headers = await authHeaders()
  if (!headers) {
    return []
  }
  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/notifications`, {
    headers,
    cache: "no-store",
  })
  if (!response.ok) {
    return []
  }
  const data = await response.json()
  return data.notifications as NotificationEntry[]
}

export async function markNotificationRead(id: string): Promise<void> {
  const headers = await authHeaders()
  if (!headers) {
    return
  }
  await fetch(`${MEDUSA_BACKEND_URL}/store/notifications/${id}/read`, {
    method: "POST",
    headers,
    cache: "no-store",
  })
}
