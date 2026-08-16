// Mirrors apps/seller-portal's returns functions in
// src/features/finance/services/finance-client.ts exactly - same
// /seller/returns* endpoints, same response shapes.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

export class ReturnsClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReturnsClientError";
  }
}

export interface ReturnRequest {
  id: string;
  vendor_order_item_id: string;
  vendor_order_id: string;
  order_id: string;
  reason: string;
  customer_comment: string | null;
  status: string;
  seller_response: string | null;
  reviewed_at: string | null;
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
    throw new ReturnsClientError(data.message || "Request failed");
  }
  return data;
}

export async function listReturnRequests(sessionToken: string): Promise<ReturnRequest[]> {
  const data = await request("/seller/returns", sessionToken);
  return data.return_requests;
}

export async function getReturnRequest(sessionToken: string, id: string): Promise<ReturnRequest> {
  const data = await request(`/seller/returns/${id}`, sessionToken);
  return data.return_request;
}

export async function approveReturnRequest(
  sessionToken: string,
  id: string,
  requestedAmount?: number
): Promise<ReturnRequest> {
  const data = await request(`/seller/returns/${id}/approve`, sessionToken, {
    method: "POST",
    body: JSON.stringify(requestedAmount ? { requested_amount: requestedAmount } : {}),
  });
  return data.return_request;
}

export async function denyReturnRequest(
  sessionToken: string,
  id: string,
  sellerResponse: string
): Promise<ReturnRequest> {
  const data = await request(`/seller/returns/${id}/deny`, sessionToken, {
    method: "POST",
    body: JSON.stringify({ seller_response: sellerResponse }),
  });
  return data.return_request;
}
