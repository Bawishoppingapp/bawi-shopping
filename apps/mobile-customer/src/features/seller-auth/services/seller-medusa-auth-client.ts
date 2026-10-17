// Mirrors apps/seller-portal/src/features/auth/services/medusa-auth-client.ts's
// loginSellerUser/getCurrentSeller exactly - same endpoints, same request/
// response shapes. Named distinctly from the customer app's own
// MedusaAuthError (features/auth/services/medusa-auth-client.ts) since both
// live in this one merged app now.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const SELLER_AUTH_TIMEOUT_MS = 30_000;

export class SellerAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SellerAuthError";
  }
}

export class SellerServiceUnavailableError extends SellerAuthError {
  constructor() {
    super("The seller service is unavailable or taking too long to respond. Please try again in a moment.");
    this.name = "SellerServiceUnavailableError";
  }
}

async function requestSellerBackend(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(`${MEDUSA_BACKEND_URL}${path}`, { ...init, signal: controller.signal }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new SellerServiceUnavailableError());
        }, SELLER_AUTH_TIMEOUT_MS);
      }),
    ]);
  } catch {
    throw new SellerServiceUnavailableError();
  } finally {
    if (timeout) clearTimeout(timeout);
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
  const response = await requestSellerBackend("/auth/seller_user/emailpass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJson(response);

  if (response.status >= 500 || response.status === 404) {
    throw new SellerServiceUnavailableError();
  }

  if (!response.ok) {
    throw new SellerAuthError("Invalid email or password");
  }

  if (typeof data.token !== "string" || !data.token) {
    throw new SellerServiceUnavailableError();
  }

  return data.token;
}

export async function completeSellerActivation(token: string, password: string): Promise<void> {
  const response = await requestSellerBackend("/seller-activation/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });

  const data = await parseJson(response);

  if (response.status >= 500 || response.status === 404) {
    throw new SellerServiceUnavailableError();
  }

  if (!response.ok) {
    throw new SellerAuthError(data.message || "Could not activate account");
  }
}

export interface SellerMe {
  seller_user: { id: string; role: string };
  seller: {
    id: string;
    name: string;
    slug: string;
    status: string;
    currency_code: string;
  };
}

/**
 * Resolves the vendor the caller's session is allowed to act as, server-side
 * - never from anything the client sends (see apps/backend's GET /seller/me).
 */
export async function getCurrentSeller(sessionToken: string): Promise<SellerMe | null> {
  const response = await requestSellerBackend("/seller/me", {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (response.status >= 500) {
    throw new SellerServiceUnavailableError();
  }

  if (!response.ok) {
    return null;
  }

  return (await parseJson(response)) as SellerMe;
}
