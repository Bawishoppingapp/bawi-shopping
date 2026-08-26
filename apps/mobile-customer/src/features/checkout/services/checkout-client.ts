// Mirrors apps/storefront/src/features/checkout/services/checkout-client.ts
// exactly - same POST /store/checkout call, same response shape. Only
// real difference: the session token comes from SecureStore (via
// token-storage.ts) instead of a cookie. This is a thin client over the
// existing backend checkout/Stripe architecture - it does not talk to
// Stripe directly (that happens via @stripe/stripe-react-native's
// PaymentSheet, initialized with the client_secret this call returns).
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export interface ShippingAddressInput {
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string;
  city: string;
  province?: string;
  postal_code?: string;
  country_code: string;
  phone: string;
  sub_city?: string;
  woreda?: string;
  landmark?: string;
  delivery_notes?: string;
}

export interface CheckoutStartResult {
  order_id: string;
  display_id: string;
  status: string;
  client_secret: string | null;
}

async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/** POST /store/checkout is idempotent per idempotencyKey - the caller
 * should generate one id per checkout attempt (not per network retry)
 * and reuse it across retries/re-presentations of the payment sheet, the
 * same way apps/storefront's checkout page holds one stable key for the
 * whole page load. */
export async function startCheckout(
  sessionToken: string | null,
  shippingAddress: ShippingAddressInput,
  idempotencyKey: string
): Promise<CheckoutStartResult> {
  if (!sessionToken) {
    throw new CheckoutError("You must be signed in to check out.");
  }

  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      shipping_address: shippingAddress,
      idempotency_key: idempotencyKey,
    }),
  });

  const data = await parseJson(response);
  if (!response.ok) {
    throw new CheckoutError(data.message || "Could not start checkout. Please try again.");
  }
  return data as CheckoutStartResult;
}
