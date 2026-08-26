// Mirrors apps/seller-portal/src/features/staff/services/staff-client.ts
// exactly - same native /seller/staff(/:id) routes, same response shapes.
// Only real difference: the session token comes from SecureStore instead
// of a cookie.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

export const STAFF_ROLES = ["catalog_manager", "order_fulfiller", "analyst"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  catalog_manager: "Catalog manager",
  order_fulfiller: "Order fulfiller",
  analyst: "Analyst",
};

export interface StaffMember {
  id: string;
  email: string;
  role: string;
  activated: boolean;
}

export class StaffClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StaffClientError";
  }
}

async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function listStaff(sessionToken: string): Promise<StaffMember[]> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller/staff`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new StaffClientError(data.message || "Could not load your team");
  }
  return data.staff as StaffMember[];
}

export async function inviteStaff(sessionToken: string, email: string, role: StaffRole): Promise<StaffMember> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller/staff`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ email, role }),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new StaffClientError(data.message || "Could not send this invite");
  }
  return data.staff as StaffMember;
}

export async function removeStaff(sessionToken: string, staffId: string): Promise<void> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller/staff/${staffId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new StaffClientError(data.message || "Could not remove this team member");
  }
}
