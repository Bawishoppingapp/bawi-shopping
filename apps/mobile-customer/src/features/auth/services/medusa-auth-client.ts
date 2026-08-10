const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

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

/**
 * Same 4-call sequence as apps/storefront/src/features/auth/services/
 * medusa-auth-client.ts, against the same Medusa endpoints - only the
 * session-token storage differs (SecureStore here instead of an httpOnly
 * cookie, since there's no cookie jar on a native client - see
 * src/features/auth/services/token-storage.ts). Medusa itself only ever
 * sees an Authorization: Bearer header either way.
 */
export async function registerCustomerAuthIdentity(email: string, password: string): Promise<string> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/auth/customer/emailpass/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new MedusaAuthError(data.message || "Could not create account");
  }

  return data.token as string;
}

export async function createCustomer(
  registrationToken: string,
  input: { email: string; first_name: string; last_name: string }
) {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${registrationToken}`,
      "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(input),
  });

  const data = await parseJson(response);

  if (!response.ok) {
    throw new MedusaAuthError(data.message || "Could not create customer");
  }

  return data.customer;
}

export async function loginCustomer(email: string, password: string): Promise<string> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/auth/customer/emailpass`, {
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

export async function getCurrentCustomer(sessionToken: string) {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/customers/me`, {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await parseJson(response);
  return data.customer ?? null;
}
