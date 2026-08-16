// Mirrors apps/seller-portal/src/features/finance/services/finance-client.ts
// exactly - same /seller/finance/* endpoints, same response shapes.
// Balance buckets are derived server-side at read time, never stored.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

export class FinanceClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceClientError";
  }
}

export interface SellerBalance {
  pending: number;
  available: number;
  paid: number;
  disputed: number;
  reversed: number;
}

export interface Payout {
  id: string;
  amount: number;
  status: string;
  stripe_transfer_id: string | null;
  created_at: string;
}

async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

async function request(path: string, sessionToken: string, init?: RequestInit) {
  const response = await fetch(`${MEDUSA_BACKEND_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new FinanceClientError(data.message || "Request failed");
  }
  return data;
}

export async function getBalance(sessionToken: string): Promise<SellerBalance> {
  const data = await request("/seller/finance/balance", sessionToken);
  return data.balance;
}

export async function listPayouts(sessionToken: string): Promise<Payout[]> {
  const data = await request("/seller/finance/payouts", sessionToken);
  return data.payouts;
}
