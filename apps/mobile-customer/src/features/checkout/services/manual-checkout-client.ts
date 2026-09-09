const BACKEND = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

export interface ManualCheckout {
  order_id: string;
  display_id: string;
  status: string;
  payment_status: string;
  payment_method: "manual_telebirr";
  payment_recipient_name: string;
  payment_recipient_phone: string;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency_code: string;
}

export class CheckoutClientError extends Error {}

async function parse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new CheckoutClientError(data.message ?? "Checkout failed");
  return data;
}

export async function startManualCheckout(token: string, shippingAddress: Record<string, unknown>, idempotencyKey: string): Promise<ManualCheckout> {
  return parse(await fetch(`${BACKEND}/store/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "x-publishable-api-key": PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ shipping_address: shippingAddress, idempotency_key: idempotencyKey }),
  }));
}

export async function submitPaymentProof(token: string, orderId: string, transactionReference: string, file: { uri: string; name: string; type: string }): Promise<void> {
  const body = new FormData();
  body.append("transaction_reference", transactionReference);
  body.append("file", file as unknown as Blob);
  await parse(await fetch(`${BACKEND}/store/orders/${orderId}/payment-proof`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "x-publishable-api-key": PUBLISHABLE_KEY },
    body,
  }));
}
