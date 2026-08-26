// Mirrors apps/storefront/src/features/notifications/services/notifications-client.ts
// exactly - same /store/notifications* endpoints, same response shapes.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

export interface NotificationEntry {
  id: string;
  event_type: string;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

function authHeaders(sessionToken: string | null): Record<string, string> | null {
  if (!sessionToken) return null;
  return {
    "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    Authorization: `Bearer ${sessionToken}`,
  };
}

export async function listNotifications(sessionToken: string | null): Promise<NotificationEntry[]> {
  const headers = authHeaders(sessionToken);
  if (!headers) return [];

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/notifications`, { headers });
  if (!response.ok) return [];

  const data = await response.json();
  return data.notifications as NotificationEntry[];
}

export async function markNotificationRead(
  sessionToken: string | null,
  id: string
): Promise<NotificationEntry | null> {
  const headers = authHeaders(sessionToken);
  if (!headers) return null;

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/notifications/${id}/read`, {
    method: "POST",
    headers,
  });
  if (!response.ok) return null;

  const data = await response.json();
  return data.notification as NotificationEntry;
}
