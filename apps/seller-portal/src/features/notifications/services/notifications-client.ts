import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export interface NotificationEntry {
  id: string
  event_type: string
  subject: string
  body: string
  read_at: string | null
  created_at: string
}

export async function listNotifications(sessionToken: string): Promise<NotificationEntry[]> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller/notifications`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })
  if (!response.ok) {
    return []
  }
  const data = await response.json()
  return data.notifications as NotificationEntry[]
}

export async function markNotificationRead(sessionToken: string, id: string): Promise<void> {
  await fetch(`${MEDUSA_BACKEND_URL}/seller/notifications/${id}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })
}
