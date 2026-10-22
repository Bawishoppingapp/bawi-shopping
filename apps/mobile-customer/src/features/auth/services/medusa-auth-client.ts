const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";
const AUTH_TIMEOUT_MS = 30_000;

export class MedusaAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MedusaAuthError";
  }
}

export class CustomerServiceUnavailableError extends Error {
  constructor() {
    super("Bawi is taking too long to respond. Please try again in a moment.");
    this.name = "CustomerServiceUnavailableError";
  }
}

async function requestCustomerBackend(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(`${MEDUSA_BACKEND_URL}${path}`, { ...init, signal: controller.signal }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new CustomerServiceUnavailableError());
        }, AUTH_TIMEOUT_MS);
      }),
    ]);
  } catch {
    throw new CustomerServiceUnavailableError();
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

/**
 * Same 4-call sequence as apps/storefront/src/features/auth/services/
 * medusa-auth-client.ts, against the same Medusa endpoints - only the
 * session-token storage differs (SecureStore here instead of an httpOnly
 * cookie, since there's no cookie jar on a native client - see
 * src/features/auth/services/token-storage.ts). Medusa itself only ever
 * sees an Authorization: Bearer header either way.
 */
export async function registerCustomerAuthIdentity(email: string, password: string): Promise<string> {
  const response = await requestCustomerBackend("/auth/customer/emailpass/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJson(response);

  if (response.status >= 500) throw new CustomerServiceUnavailableError();
  if (!response.ok) {
    throw new MedusaAuthError(data.message || "Could not create account");
  }

  return data.token as string;
}

export async function createCustomer(
  registrationToken: string,
  input: { email: string; first_name: string; last_name: string }
) {
  const response = await requestCustomerBackend("/store/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${registrationToken}`,
      "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(input),
  });

  const data = await parseJson(response);

  if (response.status >= 500) throw new CustomerServiceUnavailableError();
  if (!response.ok) {
    throw new MedusaAuthError(data.message || "Could not create customer");
  }

  return data.customer;
}

export async function loginCustomer(email: string, password: string): Promise<string> {
  const response = await requestCustomerBackend("/auth/customer/emailpass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseJson(response);

  if (response.status >= 500) throw new CustomerServiceUnavailableError();
  if (!response.ok) {
    throw new MedusaAuthError(data.message || "Invalid email or password");
  }

  return data.token as string;
}

// Always resolves - Medusa returns 201 regardless of whether the email
// matches an account, to avoid leaking which emails are registered. The
// reset link/token itself is only ever delivered by the backend's
// notification module (log-only in dev, since real_email_enabled is
// false - same limitation as seller activation, hence the paste-in-code
// UI on the reset-password screen instead of a deep link).
export async function requestPasswordReset(email: string): Promise<void> {
  const response = await requestCustomerBackend("/auth/customer/emailpass/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email }),
  });

  if (!response.ok) {
    throw new MedusaAuthError("Could not request a password reset. Please try again.");
  }
}

export async function resetPassword(email: string, resetToken: string, password: string): Promise<void> {
  const response = await requestCustomerBackend("/auth/customer/emailpass/update", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resetToken}` },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const data = await parseJson(response);
    throw new MedusaAuthError(data.message || "This reset code is invalid or has expired.");
  }
}

export async function getCurrentCustomer(sessionToken: string) {
  const response = await requestCustomerBackend("/store/customers/me", {
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    },
  });

  if (response.status >= 500) throw new CustomerServiceUnavailableError();
  if (!response.ok) {
    return null;
  }

  const data = await parseJson(response);
  return data.customer ?? null;
}

export async function deleteCustomerAccount(sessionToken: string): Promise<void> {
  const response = await requestCustomerBackend("/store/customers/me", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    },
  });
  if (!response.ok) {
    const data = await parseJson(response);
    throw new MedusaAuthError(data.message || "Could not delete account");
  }
}
