// Mirrors apps/seller-portal/src/features/fulfillment/services/fulfillment-client.ts
// exactly - same /seller/fulfillment-orders* endpoints, same response
// shapes. Bearer token only, no publishable key (seller/* routes don't
// use one). The seller never receives customer name/phone/email/address
// here - that data isn't even fetched server-side for this route (see
// docs/SECURITY.md §11).
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

export class FulfillmentClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FulfillmentClientError";
  }
}

export interface FulfillmentOrderItem {
  id: string;
  product_code: string | null;
  title: string;
  color: string | null;
  size: string | null;
  quantity: number;
}

export interface FulfillmentOrder {
  id: string;
  status: string;
  fulfillment_code: string;
  fulfillment_deadline_at: string;
  preparing_at: string | null;
  ready_for_pickup_at: string | null;
  picked_up_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
  earnings: number;
  items: FulfillmentOrderItem[];
  pickup_code: string | null;
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
    throw new FulfillmentClientError(data.message || "Request failed");
  }
  return data;
}

export async function listFulfillmentOrders(sessionToken: string): Promise<FulfillmentOrder[]> {
  const data = await request("/seller/fulfillment-orders", sessionToken);
  return data.fulfillment_orders;
}

export async function getFulfillmentOrder(sessionToken: string, id: string): Promise<FulfillmentOrder> {
  const data = await request(`/seller/fulfillment-orders/${id}`, sessionToken);
  return data.fulfillment_order;
}

export async function markPreparing(sessionToken: string, id: string): Promise<FulfillmentOrder> {
  const data = await request(`/seller/fulfillment-orders/${id}/mark-preparing`, sessionToken, {
    method: "POST",
  });
  return data.fulfillment_order;
}

export async function markReadyForPickup(sessionToken: string, id: string): Promise<FulfillmentOrder> {
  const data = await request(`/seller/fulfillment-orders/${id}/mark-ready-for-pickup`, sessionToken, {
    method: "POST",
  });
  return data.fulfillment_order;
}
