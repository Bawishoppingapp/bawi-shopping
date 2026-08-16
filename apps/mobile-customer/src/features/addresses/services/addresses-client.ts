// Mirrors apps/storefront/src/features/addresses/services/addresses-client.ts's
// listAddresses/createAddress/deleteAddress exactly - same native Medusa
// /store/customers/me/addresses(/:id) routes, same request/response
// shapes. Only real difference: the session token comes from SecureStore
// (via token-storage.ts) instead of a cookie. No update/edit endpoint
// exists on the web client either - this app matches that scope (add +
// delete only).
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

export class AddressesClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AddressesClientError";
  }
}

export interface CustomerAddress {
  id: string;
  address_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country_code: string | null;
  phone: string | null;
  is_default_shipping: boolean;
  is_default_billing: boolean;
}

export interface AddressInput {
  address_name?: string;
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  province?: string;
  postal_code: string;
  country_code: string;
  phone?: string;
  is_default_shipping?: boolean;
  is_default_billing?: boolean;
}

function authHeaders(sessionToken: string | null): Record<string, string> | null {
  if (!sessionToken) return null;
  return {
    "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    Authorization: `Bearer ${sessionToken}`,
    "Content-Type": "application/json",
  };
}

async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function listAddresses(sessionToken: string | null): Promise<CustomerAddress[]> {
  const headers = authHeaders(sessionToken);
  if (!headers) return [];

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/customers/me/addresses`, { headers });
  const data = await parseJson(response);
  if (!response.ok) return [];
  return data.addresses as CustomerAddress[];
}

export async function createAddress(sessionToken: string | null, input: AddressInput): Promise<void> {
  const headers = authHeaders(sessionToken);
  if (!headers) throw new AddressesClientError("Not authenticated");

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/customers/me/addresses`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new AddressesClientError(data.message || "Could not save this address");
  }
}

export async function deleteAddress(sessionToken: string | null, addressId: string): Promise<void> {
  const headers = authHeaders(sessionToken);
  if (!headers) throw new AddressesClientError("Not authenticated");

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/customers/me/addresses/${addressId}`, {
    method: "DELETE",
    headers,
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new AddressesClientError(data.message || "Could not remove this address");
  }
}
