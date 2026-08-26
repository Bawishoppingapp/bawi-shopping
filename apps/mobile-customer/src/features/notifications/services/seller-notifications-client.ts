// Mirrors apps/seller-portal's notifications client - same
// /seller/notifications* endpoints, same response shapes, bearer-only
// auth (no publishable key on seller/* routes).
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

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
  return { Authorization: `Bearer ${sessionToken}` };
}

export async function listSellerNotifications(sessionToken: string | null): Promise<NotificationEntry[]> {
  const headers = authHeaders(sessionToken);
  if (!headers) return [];

  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller/notifications`, { headers });
  if (!response.ok) return [];

  const data = await response.json();
  return data.notifications as NotificationEntry[];
}

export async function markSellerNotificationRead(
  sessionToken: string | null,
  id: string
): Promise<NotificationEntry | null> {
  const headers = authHeaders(sessionToken);
  if (!headers) return null;

  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller/notifications/${id}/read`, {
    method: "POST",
    headers,
  });
  if (!response.ok) return null;

  const data = await response.json();
  return data.notification as NotificationEntry;
}
