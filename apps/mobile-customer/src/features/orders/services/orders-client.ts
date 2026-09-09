// Mirrors apps/storefront/src/features/orders/services/orders-client.ts
// exactly - same native Medusa /store/orders* routes, same response
// shapes. Only real difference: the session token comes from SecureStore
// (via token-storage.ts) instead of a cookie, since there's no cookie jar
// on a native client.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

export interface OrderSummary {
  id: string;
  display_id: string;
  status: string;
  payment_status: string;
  total: number;
  currency_code: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  product_code: string | null;
  title: string;
  thumbnail: string | null;
  color: string | null;
  size: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface OrderVendorOrderTimeline {
  preparing_at: string | null;
  ready_for_pickup_at: string | null;
  picked_up_at: string | null;
  out_for_delivery_at: string | null;
  delivered_at: string | null;
}

export interface OrderVendorOrder {
  id: string;
  brand: string;
  status: string;
  fulfillment_code: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  items: OrderItem[];
  timeline: OrderVendorOrderTimeline;
  delivery_confirmation_code: string | null;
}

export interface OrderDetail {
  id: string;
  display_id: string;
  status: string;
  payment_status: string;
  payment_method: string;
  payment_reference: string | null;
  payment_rejection_reason: string | null;
  currency_code: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shipping_address: Record<string, unknown>;
  vendor_orders: OrderVendorOrder[];
  created_at: string;
}

function authHeaders(sessionToken: string | null): Record<string, string> | null {
  if (!sessionToken) return null;
  return {
    "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    Authorization: `Bearer ${sessionToken}`,
  };
}

export async function listOrders(sessionToken: string | null): Promise<OrderSummary[]> {
  const headers = authHeaders(sessionToken);
  if (!headers) return [];

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/orders`, { headers });
  if (!response.ok) return [];

  const data = await response.json();
  return data.orders as OrderSummary[];
}

export async function getOrder(orderId: string, sessionToken: string | null): Promise<OrderDetail | null> {
  const headers = authHeaders(sessionToken);
  if (!headers) return null;

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/orders/${orderId}`, { headers });
  if (!response.ok) return null;

  const data = await response.json();
  return data.order as OrderDetail;
}
