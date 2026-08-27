// Mirrors apps/storefront/src/features/cart/services/cart-client.ts exactly
// - same native Medusa /store/cart* routes, same headers, same response
// shape. Only real difference: x-cart-id and the customer bearer token
// come from SecureStore (via cart-storage.ts / token-storage.ts) instead
// of cookies, since there's no cookie jar on a native client.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

export interface CartItem {
  id: string;
  variant_id: string | null;
  product_code: string | null;
  title: string;
  thumbnail: string | null;
  brand: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  available_quantity: number;
  is_available: boolean;
  max_quantity: number;
}

export interface CartWarning {
  line_item_id: string;
  code: "unavailable" | "quantity_exceeds_inventory" | "price_changed";
  message: string;
}

export interface Cart {
  id: string;
  currency_code: string;
  items: CartItem[];
  item_count: number;
  subtotal: number;
  shipping_estimate: number;
  free_shipping_threshold: number;
  amount_remaining_for_free_shipping: number;
  qualifies_for_free_shipping: boolean;
  checkout_blocked: boolean;
  warnings: CartWarning[];
}

async function cartRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options: { cartId?: string | null; customerToken?: string | null; body?: unknown } = {}
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
  };
  if (options.cartId) headers["x-cart-id"] = options.cartId;
  if (options.customerToken) headers.Authorization = `Bearer ${options.customerToken}`;

  const response = await fetch(`${MEDUSA_BACKEND_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = (() => {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  })();

  if (!response.ok) {
    // The backend returns a specific, actionable message for known
    // failure cases (e.g. the single-currency-cart rule) - surface that
    // to the shopper instead of a generic "something went wrong."
    throw new Error(data.message || `Cart request failed (${response.status})`);
  }

  return data;
}

/** GET /store/cart never creates a cart - returns an empty public cart
 * shape if `cartId` is null or doesn't resolve to anything. */
export async function getCart(cartId: string | null, customerToken?: string | null): Promise<Cart> {
  const { cart } = await cartRequest("GET", "/store/cart", { cartId, customerToken });
  return cart;
}

/** The only route that ever creates a cart - if `cartId` is null, the
 * backend creates a new one and returns it. */
export async function addCartItem(
  cartId: string | null,
  variantId: string,
  quantity: number,
  customerToken?: string | null
): Promise<Cart> {
  const { cart } = await cartRequest("POST", "/store/cart/items", {
    cartId,
    customerToken,
    body: { variant_id: variantId, quantity },
  });
  return cart;
}

export async function updateCartItemQuantity(
  cartId: string,
  lineItemId: string,
  quantity: number,
  customerToken?: string | null
): Promise<Cart> {
  const { cart } = await cartRequest("PATCH", `/store/cart/items/${lineItemId}`, {
    cartId,
    customerToken,
    body: { quantity },
  });
  return cart;
}

export async function removeCartItem(
  cartId: string,
  lineItemId: string,
  customerToken?: string | null
): Promise<Cart> {
  const { cart } = await cartRequest("DELETE", `/store/cart/items/${lineItemId}`, { cartId, customerToken });
  return cart;
}

/** Requires customer auth - distinct backend middleware entry from the
 * general /store/cart* optional-auth one. Guest cart id goes in the
 * body, not the x-cart-id header. */
export async function mergeGuestCartIntoCustomerCart(guestCartId: string, customerToken: string): Promise<void> {
  await cartRequest("POST", "/store/cart/merge", {
    customerToken,
    body: { guest_cart_id: guestCartId },
  });
}
