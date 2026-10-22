import type { ApplicationInput } from "../schemas/application-schema";

// Mirrors apps/seller-portal/src/features/seller-application/services/seller-application-client.ts's
// submitSellerApplication/getSellerApplicationStatus exactly - same
// endpoints, same request/response shapes. No "server-only" import (this
// runs client-side in Expo) and reads EXPO_PUBLIC_MEDUSA_BACKEND_URL instead
// of the web app's server-only MEDUSA_BACKEND_URL.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const APPLICATION_TIMEOUT_MS = 30_000;

export class SellerApplicationError extends Error {
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "SellerApplicationError";
    this.fieldErrors = fieldErrors;
  }
}

export class SellerApplicationUnavailableError extends SellerApplicationError {
  constructor() {
    super("The seller service is taking too long to respond. Please try again in a moment.");
    this.name = "SellerApplicationUnavailableError";
  }
}

async function requestSellerApplicationBackend(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(`${MEDUSA_BACKEND_URL}${path}`, { ...init, signal: controller.signal }),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new SellerApplicationUnavailableError());
        }, APPLICATION_TIMEOUT_MS);
      }),
    ]);
  } catch {
    throw new SellerApplicationUnavailableError();
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

export interface SellerApplicationSummary {
  id: string;
  store_name: string;
  status: string;
  submitted_at: string;
}

export async function submitSellerApplication(input: ApplicationInput): Promise<SellerApplicationSummary> {
  const {
    address_line1,
    address_line2,
    address_city,
    address_state,
    address_postal_code,
    address_country,
    ...rest
  } = input;

  const response = await requestSellerApplicationBackend("/seller-applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...rest,
      address: {
        line1: address_line1,
        line2: address_line2 || undefined,
        city: address_city,
        state: address_state,
        postal_code: address_postal_code,
        country: address_country,
      },
    }),
  });

  const data = await parseJson(response);

  if (response.status >= 500) throw new SellerApplicationUnavailableError();
  if (!response.ok) {
    throw new SellerApplicationError(data.message || "Could not submit application", data.errors);
  }

  return data.application as SellerApplicationSummary;
}

export async function getSellerApplicationStatus(id: string): Promise<SellerApplicationSummary | null> {
  const response = await requestSellerApplicationBackend(`/seller-applications/${encodeURIComponent(id)}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) throw new SellerApplicationUnavailableError();

  const data = await parseJson(response);
  return data.application as SellerApplicationSummary | null;
}
