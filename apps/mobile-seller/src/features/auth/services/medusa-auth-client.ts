// Mirrors apps/seller-portal/src/features/auth/services/medusa-auth-client.ts's
// loginSellerUser/getCurrentSeller exactly - same endpoints, same request/
// response shapes. No "server-only" import (there's no server here) and no
// registration/activation - sellers only self-serve-activate through the
// web seller portal (one-time onboarding stays web-only per the mobile plan).
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

export class MedusaAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MedusaAuthError";
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

export async function loginSellerUser(email: string, password: string): Promise<string> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/auth/seller_user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new MedusaAuthError(data.message || "Invalid email or password");
  }

  return data.token as string;
}

export interface SellerMe {
  seller_user: { id: string; role: string };
  seller: {
    id: string;
    name: string;
    slug: string;
    status: string;
    stripe: {
      connected: boolean;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      details_submitted: boolean;
    };
  };
}

/**
 * Resolves the vendor the caller's session is allowed to act as, server-side
 * - never from anything the client sends (see apps/backend's GET /seller/me).
 */
export async function getCurrentSeller(sessionToken: string): Promise<SellerMe | null> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller/me`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (!response.ok) {
    return null;
  }

  return (await parseJson(response)) as SellerMe;
}
